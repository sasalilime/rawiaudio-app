package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"time"

	"rawiaudio.com/api/internal/service"
)

// authService est implémenté par service.Auth. En test, un faux le remplace.
type authService interface {
	RequestLogin(ctx context.Context, email string, forBrowser bool) (string, error)
	VerifyCode(ctx context.Context, email, code string) (service.Account, string, error)
	VerifyLink(ctx context.Context, token, browserProof string) (service.Account, string, error)
	Authenticate(ctx context.Context, token string) (service.Account, bool, error)
	Logout(ctx context.Context, token string) error
	DeleteAccount(ctx context.Context, accountID int64) error
}

// sessionCookie : le préfixe __Host- oblige le navigateur à n'accepter ce cookie que Secure, sur Path=/ et sans
// Domain. Aucun autre sous-domaine de rawiaudio.com ne peut donc le poser ni le remplacer.
const sessionCookie = "__Host-rawi_session"

// loginCookie : la preuve remise au navigateur qui demande un code. Le lien de l'e-mail n'ouvre une session que
// dans ce navigateur (relecture de sécurité du 27/10/2026) : un lien envoyé par quelqu'un d'autre y est refusé.
const loginCookie = "__Host-rawi_login"

// maxBodyBytes : les corps des routes de connexion font quelques dizaines d'octets.
const maxBodyBytes = 4 << 10

var (
	// tokenPattern : un jeton de lien ou de session, 32 octets en base64url sans remplissage.
	tokenPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{43}$`)
	codePattern  = regexp.MustCompile(`^[0-9]{6}$`)
)

// Requêtes : elles suivent les schémas de contracts/openapi.yaml, et se valident avant tout appel au service.

type loginRequest struct {
	Email  string `json:"email"`
	Client string `json:"client"`
}

// Validate ne vérifie que la présence : la forme de l'adresse se juge dans le service (réponse invalid_email).
func (req loginRequest) Validate() error {
	if req.Email == "" {
		return errors.New("email obligatoire")
	}
	return validateClient(req.Client)
}

type codeRequest struct {
	Email  string `json:"email"`
	Code   string `json:"code"`
	Client string `json:"client"`
}

func (req codeRequest) Validate() error {
	if req.Email == "" || !codePattern.MatchString(req.Code) {
		return errors.New("email et code de 6 chiffres obligatoires")
	}
	return validateClient(req.Client)
}

type linkRequest struct {
	Token  string `json:"token"`
	Client string `json:"client"`
}

func (req linkRequest) Validate() error {
	if !tokenPattern.MatchString(req.Token) {
		return errors.New("jeton mal formé")
	}
	return validateClient(req.Client)
}

// appFromBrowser : un navigateur qui se dit « app » pour recevoir le jeton dans la réponse. Un script injecté dans
// la PWA obtiendrait ainsi une session lisible, utilisable de partout. L'app mobile n'envoie jamais d'en-tête
// Origin ; un navigateur, toujours sur un POST.
func appFromBrowser(r *http.Request, client string) bool {
	return client == "app" && r.Header.Get("Origin") != ""
}

// validateClient : web = la PWA (session en cookie), app = l'app mobile (jeton dans la réponse).
func validateClient(client string) error {
	if !slices.Contains([]string{"web", "app"}, client) {
		return errors.New("client doit valoir web ou app")
	}
	return nil
}

type accountResponse struct {
	Email string `json:"email"`
}

type sessionResponse struct {
	Account accountResponse `json:"account"`
	Token   string          `json:"token,omitempty"` // seulement pour l'app mobile
}

// decodeJSON lit un corps JSON d'au plus limit octets : aucun champ inconnu, rien après l'objet.
func decodeJSON(w http.ResponseWriter, r *http.Request, dst any, limit int64) error {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return errors.New("données après l'objet JSON")
	}
	return nil
}

func requestLogin(auth authService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req loginRequest
		if err := decodeJSON(w, r, &req, maxBodyBytes); err != nil || req.Validate() != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_request")
			return
		}
		browserProof, err := auth.RequestLogin(r.Context(), req.Email, req.Client == "web")
		switch {
		case err == nil:
			if browserProof != "" {
				setCookie(w, loginCookie, browserProof, service.LoginRequestTTL)
			}
			w.WriteHeader(http.StatusAccepted)
		case errors.Is(err, service.ErrInvalidEmail):
			writeError(w, r, http.StatusBadRequest, "invalid_email")
		case errors.Is(err, service.ErrTooManyRequests):
			writeTooManyRequests(w, r, time.Hour)
		case errors.Is(err, service.ErrMailQuota):
			slog.ErrorContext(r.Context(), "plafond quotidien d'e-mails de connexion atteint")
			writeError(w, r, http.StatusServiceUnavailable, "unavailable")
		default:
			slog.ErrorContext(r.Context(), "demande de connexion", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
		}
	}
}

func verifyCode(auth authService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req codeRequest
		if err := decodeJSON(w, r, &req, maxBodyBytes); err != nil || req.Validate() != nil || appFromBrowser(r, req.Client) {
			writeError(w, r, http.StatusBadRequest, "invalid_request")
			return
		}
		account, token, err := auth.VerifyCode(r.Context(), req.Email, req.Code)
		writeSession(w, r, req.Client, account, token, err)
	}
}

func verifyLink(auth authService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req linkRequest
		if err := decodeJSON(w, r, &req, maxBodyBytes); err != nil || req.Validate() != nil || appFromBrowser(r, req.Client) {
			writeError(w, r, http.StatusBadRequest, "invalid_request")
			return
		}
		proof := ""
		if cookie, err := r.Cookie(loginCookie); err == nil {
			proof = cookie.Value
		}
		account, token, err := auth.VerifyLink(r.Context(), req.Token, proof)
		writeSession(w, r, req.Client, account, token, err)
	}
}

// writeSession répond à une vérification de code ou de lien. La PWA reçoit le jeton dans un cookie que son
// JavaScript ne peut pas lire (HttpOnly) ; l'app mobile le reçoit dans la réponse, pour son trousseau.
func writeSession(w http.ResponseWriter, r *http.Request, client string, account service.Account, token string, err error) {
	if errors.Is(err, service.ErrInvalidCode) {
		writeError(w, r, http.StatusBadRequest, "invalid_code")
		return
	}
	if err != nil {
		slog.ErrorContext(r.Context(), "ouverture de session", "err", err)
		writeError(w, r, http.StatusInternalServerError, "internal")
		return
	}
	body := sessionResponse{Account: accountResponse{Email: account.Email}}
	if client == "app" {
		body.Token = token
	} else {
		setSessionCookie(w, token)
		clearCookie(w, loginCookie) // la preuve a servi : la demande est fermée
	}
	writeJSON(w, r, http.StatusOK, body)
}

func logout(auth authService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s := sessionFrom(r.Context())
		if err := auth.Logout(r.Context(), s.token); err != nil {
			slog.ErrorContext(r.Context(), "déconnexion", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
			return
		}
		if s.fromCookie {
			clearSessionCookie(w)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func getAccount() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, r, http.StatusOK, accountResponse{Email: sessionFrom(r.Context()).account.Email})
	}
}

// deleteAccount supprime le compte de la session, jamais un autre : l'identifiant vient de la session,
// pas de la requête.
func deleteAccount(auth authService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		s := sessionFrom(r.Context())
		if err := auth.DeleteAccount(r.Context(), s.account.ID); err != nil {
			slog.ErrorContext(r.Context(), "suppression du compte", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
			return
		}
		if s.fromCookie {
			clearSessionCookie(w)
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

// session : ce que requireAccount a vérifié, transmis aux handlers par le contexte de la requête.
type session struct {
	account    service.Account
	token      string
	fromCookie bool // PWA : le cookie est à prolonger ou à effacer ; app mobile : rien à faire
}

type sessionKey struct{}

// sessionFrom lit la session posée par requireAccount. Une route de niveau « compte » passe toujours par lui :
// sans session ici, c'est un oubli dans routes.go, qui doit planter plutôt qu'ouvrir la route.
func sessionFrom(ctx context.Context) session {
	s, ok := ctx.Value(sessionKey{}).(session)
	if !ok {
		panic("route de niveau compte sans requireAccount")
	}
	return s
}

// requireAccount n'appelle next qu'avec une session valide, sinon 401. Jeton lu dans Authorization (app mobile)
// ou dans le cookie (PWA). Une session prolongée renvoie un cookie qui dure autant.
func requireAccount(auth authService, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, fromCookie, ok := sessionToken(r)
		if !ok {
			writeError(w, r, http.StatusUnauthorized, "unauthorized")
			return
		}
		account, extended, err := auth.Authenticate(r.Context(), token)
		if errors.Is(err, service.ErrUnauthorized) {
			if fromCookie {
				clearSessionCookie(w)
			}
			writeError(w, r, http.StatusUnauthorized, "unauthorized")
			return
		}
		if err != nil {
			slog.ErrorContext(r.Context(), "lecture de la session", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
			return
		}
		if extended && fromCookie {
			setSessionCookie(w, token)
		}
		ctx := context.WithValue(r.Context(), sessionKey{}, session{account: account, token: token, fromCookie: fromCookie})
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// sessionToken : le jeton de la requête, s'il a la bonne forme. Un jeton mal formé ne va pas jusqu'à la base.
func sessionToken(r *http.Request) (token string, fromCookie, ok bool) {
	if header := r.Header.Get("Authorization"); header != "" {
		token, found := strings.CutPrefix(header, "Bearer ")
		return token, false, found && tokenPattern.MatchString(token)
	}
	cookie, err := r.Cookie(sessionCookie)
	if err != nil {
		return "", false, false
	}
	return cookie.Value, true, tokenPattern.MatchString(cookie.Value)
}

func setSessionCookie(w http.ResponseWriter, token string) {
	setCookie(w, sessionCookie, token, service.SessionTTL)
}

func clearSessionCookie(w http.ResponseWriter) {
	clearCookie(w, sessionCookie)
}

// setCookie pose un cookie de l'API : HttpOnly (le JavaScript de la page ne le voit pas, une faille XSS ne peut
// pas le voler), Secure, SameSite=Lax, sur tout le domaine de l'API.
func setCookie(w http.ResponseWriter, name, value string, maxAge time.Duration) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: value, Path: "/", MaxAge: int(maxAge / time.Second),
		HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
}

func clearCookie(w http.ResponseWriter, name string) {
	http.SetCookie(w, &http.Cookie{
		Name: name, Value: "", Path: "/", MaxAge: -1, HttpOnly: true, Secure: true, SameSite: http.SameSiteLaxMode,
	})
}

func writeTooManyRequests(w http.ResponseWriter, r *http.Request, retryAfter time.Duration) {
	w.Header().Set("Retry-After", fmt.Sprint(int(retryAfter/time.Second)))
	writeError(w, r, http.StatusTooManyRequests, "too_many_requests")
}

// CrossOrigin refuse (403) une requête qui modifie quelque chose quand elle vient d'un autre site (CSRF),
// sauf de trustedOrigin, la PWA. SameSite=Lax ne suffit pas : le site vitrine, sur rawiaudio.com, est du
// même site que l'API. http.CrossOriginProtection lit Sec-Fetch-Site ou Origin ; une requête sans ces
// en-têtes (app mobile, curl) ne vient pas d'un navigateur piégé et passe.
func CrossOrigin(trustedOrigin string) (func(http.Handler) http.Handler, error) {
	protection := http.NewCrossOriginProtection()
	if trustedOrigin != "" {
		if err := protection.AddTrustedOrigin(trustedOrigin); err != nil {
			return nil, fmt.Errorf("origine de confiance %q: %w", trustedOrigin, err)
		}
	}
	protection.SetDenyHandler(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		writeError(w, r, http.StatusForbidden, "forbidden")
	}))
	return protection.Handler, nil
}
