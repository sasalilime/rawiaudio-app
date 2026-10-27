package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"math/big"
	"net/mail"
	"strings"
	"time"
)

// Durées et limites de la connexion (ADR-0012).
const (
	LoginRequestTTL = 10 * time.Minute // durée de vie d'un code et de son lien
	// MaxRequestsPerEmail demandes par adresse et par heure : avec 5 essais chacune, au plus 15 codes tentés
	// par heure sur un million possibles.
	MaxRequestsPerEmail = 3
	SessionTTL          = 180 * 24 * time.Hour // prolongée à l'usage
	// sessionRefreshAfter : last_seen_at et l'expiration ne s'écrivent qu'une fois par jour, pas à chaque requête.
	sessionRefreshAfter = 24 * time.Hour
	// mailSendTimeout reste sous le WriteTimeout du serveur HTTP (15 s) : la réponse part toujours.
	mailSendTimeout = 10 * time.Second
	// loginRequestsKeptFor : les demandes servent aux limites (par heure, par jour), puis sont supprimées.
	loginRequestsKeptFor = 24 * time.Hour
)

var (
	ErrInvalidEmail    = errors.New("adresse e-mail invalide")
	ErrInvalidCode     = errors.New("code ou lien refusé")
	ErrTooManyRequests = errors.New("trop de demandes de connexion pour cette adresse")
	ErrMailQuota       = errors.New("plafond quotidien d'e-mails de connexion atteint")
	ErrUnauthorized    = errors.New("session absente ou expirée")
)

// Account est un compte : une famille, une adresse e-mail.
type Account struct {
	ID    int64
	Email string
}

// NewLoginRequest est ce que la base garde d'une demande de connexion : jamais le code ni le jeton en clair.
type NewLoginRequest struct {
	Email     string
	CodeHMAC  []byte
	TokenHash []byte
	ExpiresAt time.Time
}

// PendingLogin est une demande de connexion encore ouverte, retrouvée par son adresse ou par son jeton.
type PendingLogin struct {
	ID       int64
	Email    string
	CodeHMAC []byte
}

// NewSession est une session à créer ; le jeton reste chez le client, la base n'en garde que l'empreinte.
type NewSession struct {
	TokenHash []byte
	ExpiresAt time.Time
}

// SessionAccount est le compte d'une session valide, avec sa dernière utilisation enregistrée.
type SessionAccount struct {
	Account    Account
	LastSeenAt time.Time
}

// AuthStore lit et écrit les comptes, demandes de connexion et sessions. Implémenté par repository.Auth.
type AuthStore interface {
	// CountLoginRequests compte les demandes de cette adresse créées après since.
	CountLoginRequests(ctx context.Context, email string, since time.Time) (int, error)
	// CountAllLoginRequests compte toutes les demandes créées après since (plafond d'e-mails).
	CountAllLoginRequests(ctx context.Context, since time.Time) (int, error)
	// CreateLoginRequest ferme les demandes encore ouvertes de l'adresse, puis enregistre la nouvelle.
	CreateLoginRequest(ctx context.Context, req NewLoginRequest, now time.Time) error
	// AttemptCode compte un essai sur la demande ouverte la plus récente de l'adresse, et la renvoie.
	// ErrInvalidCode s'il n'y en a pas, si elle a expiré ou si ses essais sont épuisés.
	AttemptCode(ctx context.Context, email string, now time.Time) (PendingLogin, error)
	// PendingByToken renvoie la demande ouverte de ce jeton, ou ErrInvalidCode.
	PendingByToken(ctx context.Context, tokenHash []byte, now time.Time) (PendingLogin, error)
	// CompleteLogin ferme la demande, crée le compte s'il n'existe pas et ouvre la session, d'un seul bloc.
	// ErrInvalidCode si la demande vient d'être fermée par une autre requête (usage unique).
	CompleteLogin(ctx context.Context, requestID int64, email string, session NewSession, now time.Time) (Account, error)
	// SessionAccount renvoie le compte d'une session non expirée, ou ErrUnauthorized.
	SessionAccount(ctx context.Context, tokenHash []byte, now time.Time) (SessionAccount, error)
	ExtendSession(ctx context.Context, tokenHash []byte, lastSeenAt, expiresAt time.Time) error
	DeleteSession(ctx context.Context, tokenHash []byte) error
	// DeleteAccount supprime le compte, ses sessions et les demandes de connexion de son adresse.
	DeleteAccount(ctx context.Context, accountID int64) error
	// DeleteExpired supprime les demandes créées avant requestsBefore et les sessions expirées à now.
	DeleteExpired(ctx context.Context, requestsBefore, now time.Time) error
}

// MailSender envoie un e-mail texte. Implémenté par mail.Sender.
type MailSender interface {
	Send(ctx context.Context, to, subject, text string) error
}

// Auth porte les règles de la connexion par e-mail (ADR-0012).
type Auth struct {
	store        AuthStore
	mail         MailSender
	secret       []byte // AUTH_SECRET, clé du HMAC des codes : ne jamais la logger
	appURL       string // https://app.rawiaudio.com, sans / final : le lien de l'e-mail y mène
	dailyMailCap int    // e-mails de connexion par 24 heures, sous le quota du fournisseur
	now          func() time.Time
}

func NewAuth(store AuthStore, mail MailSender, secret []byte, appURL string, dailyMailCap int, now func() time.Time) *Auth {
	return &Auth{store: store, mail: mail, secret: secret, appURL: appURL, dailyMailCap: dailyMailCap, now: now}
}

// NormalizeEmail retire les espaces, passe en minuscules et vérifie la forme : une adresse nue, sans nom
// (« Nom <a@b.fr> » est refusé), 254 caractères au plus.
func NormalizeEmail(raw string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(raw))
	if len(email) < 3 || len(email) > 254 {
		return "", ErrInvalidEmail
	}
	addr, err := mail.ParseAddress(email)
	if err != nil || addr.Name != "" || addr.Address != email {
		return "", ErrInvalidEmail
	}
	return email, nil
}

// RequestLogin envoie l'e-mail de connexion. S'inscrire = se connecter : la réponse est la même pour une
// adresse connue ou non, et le compte n'est créé qu'à la première vérification réussie.
//
// ponytail: compter puis insérer n'est pas atomique ; deux demandes simultanées peuvent dépasser la limite
// d'une unité. Sans gravité ici ; un verrou par adresse (pg_advisory_xact_lock) si ça devenait un problème.
func (a *Auth) RequestLogin(ctx context.Context, rawEmail string) error {
	email, err := NormalizeEmail(rawEmail)
	if err != nil {
		return err
	}
	now := a.now()

	recent, err := a.store.CountLoginRequests(ctx, email, now.Add(-time.Hour))
	if err != nil {
		return fmt.Errorf("demandes récentes de l'adresse: %w", err)
	}
	if recent >= MaxRequestsPerEmail {
		return ErrTooManyRequests
	}
	today, err := a.store.CountAllLoginRequests(ctx, now.Add(-24*time.Hour))
	if err != nil {
		return fmt.Errorf("demandes du jour: %w", err)
	}
	if today >= a.dailyMailCap {
		return ErrMailQuota
	}

	code, err := newCode()
	if err != nil {
		return err
	}
	token := newToken()
	err = a.store.CreateLoginRequest(ctx, NewLoginRequest{
		Email:     email,
		CodeHMAC:  a.codeHMAC(email, code),
		TokenHash: hashToken(token),
		ExpiresAt: now.Add(LoginRequestTTL),
	}, now)
	if err != nil {
		return fmt.Errorf("enregistrement de la demande: %w", err)
	}

	// Le jeton dans le fragment (#) : il n'arrive jamais dans les journaux d'un serveur ni dans un Referer.
	subject, text := LoginMail(code, a.appURL+"/connexion#jeton="+token, LoginRequestTTL)
	sendCtx, cancel := context.WithTimeout(ctx, mailSendTimeout)
	defer cancel()
	if err := a.mail.Send(sendCtx, email, subject, text); err != nil {
		return fmt.Errorf("envoi de l'e-mail de connexion: %w", err)
	}
	return nil
}

// VerifyCode vérifie le code reçu par e-mail. S'il est bon, crée le compte si besoin et ouvre une session :
// renvoie le compte et le jeton de session, à remettre au client. Toute erreur de code donne ErrInvalidCode,
// sans dire laquelle (faux, expiré, déjà utilisé, essais épuisés, aucune demande).
func (a *Auth) VerifyCode(ctx context.Context, rawEmail, code string) (Account, string, error) {
	email, err := NormalizeEmail(rawEmail)
	if err != nil {
		return Account{}, "", ErrInvalidCode
	}
	now := a.now()
	pending, err := a.store.AttemptCode(ctx, email, now)
	if err != nil {
		return Account{}, "", err // ErrInvalidCode, ou une erreur de base déjà annotée
	}
	// Comparaison en temps constant : le temps de réponse ne dit pas combien de caractères sont bons.
	if !hmac.Equal(pending.CodeHMAC, a.codeHMAC(email, code)) {
		return Account{}, "", ErrInvalidCode
	}
	return a.openSession(ctx, pending, now)
}

// VerifyLink vérifie le jeton du lien reçu par e-mail ; mêmes résultats que VerifyCode.
// Pas de compte d'essais : un jeton de 32 octets aléatoires ne se devine pas.
func (a *Auth) VerifyLink(ctx context.Context, token string) (Account, string, error) {
	now := a.now()
	pending, err := a.store.PendingByToken(ctx, hashToken(token), now)
	if err != nil {
		return Account{}, "", err
	}
	return a.openSession(ctx, pending, now)
}

func (a *Auth) openSession(ctx context.Context, pending PendingLogin, now time.Time) (Account, string, error) {
	token := newToken()
	account, err := a.store.CompleteLogin(ctx, pending.ID, pending.Email, NewSession{
		TokenHash: hashToken(token),
		ExpiresAt: now.Add(SessionTTL),
	}, now)
	if err != nil {
		return Account{}, "", err
	}
	return account, token, nil
}

// Authenticate renvoie le compte d'un jeton de session, ou ErrUnauthorized. extended vaut true quand la session
// vient d'être prolongée : la PWA doit alors recevoir un cookie qui dure autant.
func (a *Auth) Authenticate(ctx context.Context, token string) (account Account, extended bool, err error) {
	now := a.now()
	hash := hashToken(token)
	session, err := a.store.SessionAccount(ctx, hash, now)
	if err != nil {
		return Account{}, false, err
	}
	if now.Sub(session.LastSeenAt) >= sessionRefreshAfter {
		if err := a.store.ExtendSession(ctx, hash, now, now.Add(SessionTTL)); err != nil {
			return Account{}, false, fmt.Errorf("prolongation de la session: %w", err)
		}
		extended = true
	}
	return session.Account, extended, nil
}

// Logout ferme la session de ce jeton.
func (a *Auth) Logout(ctx context.Context, token string) error {
	if err := a.store.DeleteSession(ctx, hashToken(token)); err != nil {
		return fmt.Errorf("fermeture de la session: %w", err)
	}
	return nil
}

// DeleteAccount supprime le compte et tout ce qui s'y rattache (droit à l'effacement, règle 5.1.1(v) d'Apple).
func (a *Auth) DeleteAccount(ctx context.Context, accountID int64) error {
	if err := a.store.DeleteAccount(ctx, accountID); err != nil {
		return fmt.Errorf("suppression du compte: %w", err)
	}
	return nil
}

// Cleanup supprime les demandes de plus d'un jour et les sessions expirées. Appelé chaque heure par main.
func (a *Auth) Cleanup(ctx context.Context) error {
	now := a.now()
	if err := a.store.DeleteExpired(ctx, now.Add(-loginRequestsKeptFor), now); err != nil {
		return fmt.Errorf("ménage des demandes et sessions: %w", err)
	}
	return nil
}

// codeHMAC : l'empreinte d'un code. Un code de 6 chiffres n'a qu'un million de valeurs : un simple SHA-256 se
// retrouverait en une seconde si la base fuyait. La clé secrète, hors de la base, l'empêche.
// L'adresse entre dans le calcul : le code d'une adresse ne vaut rien pour une autre.
func (a *Auth) codeHMAC(email, code string) []byte {
	mac := hmac.New(sha256.New, a.secret)
	mac.Write([]byte(email)) // l'écriture dans un hash n'échoue jamais
	mac.Write([]byte{0})     // séparateur : « ab » + « c » et « a » + « bc » ne donnent pas la même empreinte
	mac.Write([]byte(code))
	return mac.Sum(nil)
}

// newCode tire un code de 6 chiffres, chacun aussi probable (000000 à 999999).
func newCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", fmt.Errorf("tirage du code: %w", err)
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// newToken tire 32 octets aléatoires, en base64url sans remplissage (43 caractères) : jeton de lien ou de session.
func newToken() string {
	b := make([]byte, 32)
	rand.Read(b) // ne renvoie jamais d'erreur depuis Go 1.24 : en cas de panne du système, le programme s'arrête
	return base64.RawURLEncoding.EncodeToString(b)
}

// hashToken : l'empreinte stockée d'un jeton. SHA-256 suffit : 32 octets aléatoires ne se devinent pas.
func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}
