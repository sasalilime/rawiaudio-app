// Tests de la connexion contre la vraie base (schéma jetable) : service.Auth et repository.Auth ensemble.
// Paquet service_test : il peut importer repository, qui importe service, sans cycle.
package service_test

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"rawiaudio.com/api/internal/migrate"
	"rawiaudio.com/api/internal/pgtest"
	"rawiaudio.com/api/internal/repository"
	"rawiaudio.com/api/internal/service"
	"rawiaudio.com/api/migrations"
)

// sentMail : le dernier e-mail « envoyé », gardé au lieu de partir.
type sentMail struct {
	mu                sync.Mutex
	to, subject, text string
	count             int
}

func (m *sentMail) Send(_ context.Context, to, subject, text string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.to, m.subject, m.text = to, subject, text
	m.count++
	return nil
}

var (
	codeInSubject = regexp.MustCompile(`\b([0-9]{6})$`)
	tokenInLink   = regexp.MustCompile(`/connexion#jeton=([A-Za-z0-9_-]{43})\n`)
)

// codeAndToken : le code et le jeton du dernier e-mail.
func (m *sentMail) codeAndToken(t *testing.T) (code, token string) {
	t.Helper()
	m.mu.Lock()
	defer m.mu.Unlock()
	c := codeInSubject.FindStringSubmatch(m.subject)
	k := tokenInLink.FindStringSubmatch(m.text)
	if c == nil || k == nil {
		t.Fatalf("code ou lien introuvable dans l'e-mail : %q\n%s", m.subject, m.text)
	}
	return c[1], k[1]
}

// clock : une heure réglable à la main, pour avancer le temps sans attendre.
type clock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *clock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *clock) Advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

type fixture struct {
	pool  *pgxpool.Pool
	auth  *service.Auth
	mail  *sentMail
	clock *clock
}

func newFixture(t *testing.T, dailyMailCap int) fixture {
	t.Helper()
	pool := pgtest.Pool(t)
	if err := migrate.Run(t.Context(), pool, migrations.FS); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	f := fixture{pool: pool, mail: &sentMail{}, clock: &clock{now: time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)}}
	f.auth = service.NewAuth(repository.NewAuth(pool), f.mail, []byte("secret-de-test-de-32-caracteres!"),
		"https://app.rawiaudio.com", dailyMailCap, f.clock.Now)
	return f
}

// login demande un code pour email puis le vérifie ; renvoie le compte et le jeton de session.
func (f fixture) login(t *testing.T, email string) (service.Account, string) {
	t.Helper()
	if err := f.auth.RequestLogin(t.Context(), email); err != nil {
		t.Fatalf("RequestLogin(%q): %v", email, err)
	}
	code, _ := f.mail.codeAndToken(t)
	account, token, err := f.auth.VerifyCode(t.Context(), email, code)
	if err != nil {
		t.Fatalf("VerifyCode(%q): %v", email, err)
	}
	return account, token
}

func TestLoginByCodeOpensASessionThenLogoutClosesIt(t *testing.T) {
	f := newFixture(t, 90)
	if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
		t.Fatal(err)
	}
	if f.mail.to != "parent@example.com" {
		t.Errorf("e-mail envoyé à %q", f.mail.to)
	}
	code, _ := f.mail.codeAndToken(t)

	account, token, err := f.auth.VerifyCode(t.Context(), "parent@example.com", code)
	if err != nil {
		t.Fatal(err)
	}
	if account.Email != "parent@example.com" || account.ID == 0 || len(token) != 43 {
		t.Fatalf("compte %+v, jeton %q", account, token)
	}
	got, _, err := f.auth.Authenticate(t.Context(), token)
	if err != nil || got != account {
		t.Fatalf("Authenticate : %+v, %v", got, err)
	}

	if err := f.auth.Logout(t.Context(), token); err != nil {
		t.Fatal(err)
	}
	if _, _, err := f.auth.Authenticate(t.Context(), token); !errors.Is(err, service.ErrUnauthorized) {
		t.Errorf("session encore valide après la déconnexion : %v", err)
	}
}

func TestLoginByLinkIsSingleUseAndClosesTheCode(t *testing.T) {
	f := newFixture(t, 90)
	if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
		t.Fatal(err)
	}
	code, link := f.mail.codeAndToken(t)

	account, token, err := f.auth.VerifyLink(t.Context(), link)
	if err != nil || account.Email != "parent@example.com" || token == "" {
		t.Fatalf("VerifyLink : %+v, %q, %v", account, token, err)
	}
	if _, _, err := f.auth.VerifyLink(t.Context(), link); !errors.Is(err, service.ErrInvalidCode) {
		t.Errorf("lien réutilisé : %v", err)
	}
	if _, _, err := f.auth.VerifyCode(t.Context(), "parent@example.com", code); !errors.Is(err, service.ErrInvalidCode) {
		t.Errorf("code encore valable après le lien : %v", err)
	}
}

func TestCodeIsRefused(t *testing.T) {
	t.Run("déjà utilisé", func(t *testing.T) {
		f := newFixture(t, 90)
		f.login(t, "parent@example.com")
		code, _ := f.mail.codeAndToken(t)
		if _, _, err := f.auth.VerifyCode(t.Context(), "parent@example.com", code); !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("code réutilisé : %v", err)
		}
	})

	t.Run("expiré après 10 minutes", func(t *testing.T) {
		f := newFixture(t, 90)
		if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
			t.Fatal(err)
		}
		code, link := f.mail.codeAndToken(t)
		f.clock.Advance(service.LoginRequestTTL)
		if _, _, err := f.auth.VerifyCode(t.Context(), "parent@example.com", code); !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("code expiré accepté : %v", err)
		}
		if _, _, err := f.auth.VerifyLink(t.Context(), link); !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("lien expiré accepté : %v", err)
		}
	})

	t.Run("remplacé par une demande plus récente", func(t *testing.T) {
		f := newFixture(t, 90)
		if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
			t.Fatal(err)
		}
		oldCode, oldLink := f.mail.codeAndToken(t)
		if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
			t.Fatal(err)
		}
		newCode, _ := f.mail.codeAndToken(t)
		if oldCode == newCode {
			t.Skip("même code tiré deux fois (une chance sur un million)")
		}
		if _, _, err := f.auth.VerifyLink(t.Context(), oldLink); !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("ancien lien accepté : %v", err)
		}
		if _, _, err := f.auth.VerifyCode(t.Context(), "parent@example.com", oldCode); !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("ancien code accepté : %v", err)
		}
		if _, _, err := f.auth.VerifyCode(t.Context(), "parent@example.com", newCode); err != nil {
			t.Errorf("nouveau code refusé : %v", err)
		}
	})

	t.Run("pour une autre adresse", func(t *testing.T) {
		f := newFixture(t, 90)
		if err := f.auth.RequestLogin(t.Context(), "a@example.com"); err != nil {
			t.Fatal(err)
		}
		codeA, _ := f.mail.codeAndToken(t)
		if err := f.auth.RequestLogin(t.Context(), "b@example.com"); err != nil {
			t.Fatal(err)
		}
		if _, _, err := f.auth.VerifyCode(t.Context(), "b@example.com", codeA); !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("le code de a ouvre le compte de b : %v", err)
		}
	})

	t.Run("après 5 essais faux, même le bon", func(t *testing.T) {
		f := newFixture(t, 90)
		if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
			t.Fatal(err)
		}
		code, _ := f.mail.codeAndToken(t)
		wrong := "000000"
		if code == wrong {
			wrong = "111111"
		}
		for range 5 {
			if _, _, err := f.auth.VerifyCode(t.Context(), "parent@example.com", wrong); !errors.Is(err, service.ErrInvalidCode) {
				t.Fatalf("mauvais code : %v", err)
			}
		}
		if _, _, err := f.auth.VerifyCode(t.Context(), "parent@example.com", code); !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("bon code accepté après 5 essais : %v", err)
		}
	})
}

// Des essais en rafale ne dépassent pas 5 (aucune erreur de la contrainte CHECK), et un bon code envoyé deux fois
// en même temps n'ouvre qu'une session.
func TestCodeAttemptsHoldUnderConcurrency(t *testing.T) {
	f := newFixture(t, 90)
	if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
		t.Fatal(err)
	}
	code, _ := f.mail.codeAndToken(t)

	var wg sync.WaitGroup
	results := make(chan error, 2)
	for range 2 {
		wg.Go(func() {
			_, _, err := f.auth.VerifyCode(context.Background(), "parent@example.com", code)
			results <- err
		})
	}
	wg.Wait()
	close(results)
	var ok, refused int
	for err := range results {
		switch {
		case err == nil:
			ok++
		case errors.Is(err, service.ErrInvalidCode):
			refused++
		default:
			t.Errorf("erreur inattendue : %v", err)
		}
	}
	if ok != 1 || refused != 1 {
		t.Errorf("bon code envoyé deux fois en même temps : %d acceptés, %d refusés", ok, refused)
	}

	if err := f.auth.RequestLogin(t.Context(), "autre@example.com"); err != nil {
		t.Fatal(err)
	}
	errs := make(chan error, 12)
	for range 12 {
		wg.Go(func() {
			_, _, err := f.auth.VerifyCode(context.Background(), "autre@example.com", "abcdef")
			errs <- err
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if !errors.Is(err, service.ErrInvalidCode) {
			t.Errorf("essai en rafale : %v", err)
		}
	}
}

func TestRequestLoginLimits(t *testing.T) {
	t.Run("3 demandes par adresse et par heure", func(t *testing.T) {
		f := newFixture(t, 90)
		for range service.MaxRequestsPerEmail {
			if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
				t.Fatal(err)
			}
		}
		if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); !errors.Is(err, service.ErrTooManyRequests) {
			t.Errorf("4e demande : %v", err)
		}
		if f.mail.count != service.MaxRequestsPerEmail {
			t.Errorf("%d e-mails partis, attendu %d", f.mail.count, service.MaxRequestsPerEmail)
		}
		if err := f.auth.RequestLogin(t.Context(), "autre@example.com"); err != nil {
			t.Errorf("une autre adresse est bloquée : %v", err)
		}
		f.clock.Advance(time.Hour)
		if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
			t.Errorf("toujours bloquée une heure après : %v", err)
		}
	})

	t.Run("plafond quotidien d'e-mails", func(t *testing.T) {
		f := newFixture(t, 2)
		for _, email := range []string{"a@example.com", "b@example.com"} {
			if err := f.auth.RequestLogin(t.Context(), email); err != nil {
				t.Fatal(err)
			}
		}
		if err := f.auth.RequestLogin(t.Context(), "c@example.com"); !errors.Is(err, service.ErrMailQuota) {
			t.Errorf("au-delà du plafond : %v", err)
		}
	})
}

func TestEmailIsNormalized(t *testing.T) {
	f := newFixture(t, 90)
	first, _ := f.login(t, "  Parent@Example.COM ")
	second, _ := f.login(t, "parent@example.com")
	if first.ID != second.ID || first.Email != "parent@example.com" {
		t.Errorf("deux comptes pour la même adresse : %+v et %+v", first, second)
	}

	for _, email := range []string{"", "pasdarobase", "Parent <parent@example.com>", "a@b\r\nBcc: c@d", strings.Repeat("a", 250) + "@x.fr"} {
		if err := f.auth.RequestLogin(t.Context(), email); !errors.Is(err, service.ErrInvalidEmail) {
			t.Errorf("%q : %v", email, err)
		}
	}
}

// L'utilisateur A ne voit jamais le compte de B : chaque jeton donne son propre compte.
func TestEachSessionGivesItsOwnAccount(t *testing.T) {
	f := newFixture(t, 90)
	a, tokenA := f.login(t, "a@example.com")
	b, tokenB := f.login(t, "b@example.com")
	gotA, _, errA := f.auth.Authenticate(t.Context(), tokenA)
	gotB, _, errB := f.auth.Authenticate(t.Context(), tokenB)
	if errA != nil || errB != nil || gotA != a || gotB != b || a.ID == b.ID {
		t.Errorf("A : %+v (%v), B : %+v (%v)", gotA, errA, gotB, errB)
	}
}

func TestSessionIsExtendedOnceADayAndExpiresUnused(t *testing.T) {
	f := newFixture(t, 90)
	_, token := f.login(t, "parent@example.com")

	if _, extended, err := f.auth.Authenticate(t.Context(), token); err != nil || extended {
		t.Errorf("tout de suite : prolongée %v, %v", extended, err)
	}
	f.clock.Advance(25 * time.Hour)
	if _, extended, err := f.auth.Authenticate(t.Context(), token); err != nil || !extended {
		t.Errorf("le lendemain : prolongée %v, %v", extended, err)
	}
	if _, extended, err := f.auth.Authenticate(t.Context(), token); err != nil || extended {
		t.Errorf("deux fois le même jour : prolongée %v, %v", extended, err)
	}

	// Prolongée le lendemain : elle vit encore 179 jours plus tard, plus 180 jours sans usage.
	f.clock.Advance(service.SessionTTL - time.Hour)
	if _, _, err := f.auth.Authenticate(t.Context(), token); err != nil {
		t.Errorf("session prolongée expirée trop tôt : %v", err)
	}
	f.clock.Advance(service.SessionTTL)
	if _, _, err := f.auth.Authenticate(t.Context(), token); !errors.Is(err, service.ErrUnauthorized) {
		t.Errorf("session inutilisée 180 jours encore valide : %v", err)
	}
}

func TestDeleteAccountRemovesItsSessions(t *testing.T) {
	f := newFixture(t, 90)
	account, token := f.login(t, "parent@example.com")
	_, otherDevice := f.login(t, "parent@example.com")

	if err := f.auth.DeleteAccount(t.Context(), account.ID); err != nil {
		t.Fatal(err)
	}
	for _, tok := range []string{token, otherDevice} {
		if _, _, err := f.auth.Authenticate(t.Context(), tok); !errors.Is(err, service.ErrUnauthorized) {
			t.Errorf("session encore valide après suppression du compte : %v", err)
		}
	}
	again, _ := f.login(t, "parent@example.com")
	if again.ID == account.ID {
		t.Error("le compte supprimé est revenu")
	}
}

func TestCleanupRemovesOldRequestsAndExpiredSessions(t *testing.T) {
	f := newFixture(t, 90)
	_, token := f.login(t, "parent@example.com")
	f.clock.Advance(service.SessionTTL + time.Hour)
	if err := f.auth.Cleanup(t.Context()); err != nil {
		t.Fatal(err)
	}
	// Après le ménage, les limites repartent de zéro et l'ancienne session n'existe plus.
	if _, _, err := f.auth.Authenticate(t.Context(), token); !errors.Is(err, service.ErrUnauthorized) {
		t.Errorf("session expirée : %v", err)
	}
	for range service.MaxRequestsPerEmail {
		if err := f.auth.RequestLogin(t.Context(), "parent@example.com"); err != nil {
			t.Fatal(err)
		}
	}
}
