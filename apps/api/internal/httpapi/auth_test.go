package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"rawiaudio.com/api/internal/service"
)

// Jetons de session de test : 43 caractères, comme les vrais.
var (
	tokenA = strings.Repeat("A", 43)
	tokenB = strings.Repeat("B", 43)
)

// fakeAuth : deux comptes, A et B, chacun avec sa session. Il note ce que les handlers lui demandent.
type fakeAuth struct {
	requestErr error
	verifyErr  error
	extended   bool
	loggedOut  string // jeton passé à Logout
	deletedID  int64  // compte passé à DeleteAccount
	requested  string // adresse passée à RequestLogin
}

var (
	accountA = service.Account{ID: 1, Email: "a@example.com"}
	accountB = service.Account{ID: 2, Email: "b@example.com"}
)

func (f *fakeAuth) RequestLogin(_ context.Context, email string) error {
	f.requested = email
	return f.requestErr
}

func (f *fakeAuth) VerifyCode(_ context.Context, _, _ string) (service.Account, string, error) {
	return accountA, tokenA, f.verifyErr
}

func (f *fakeAuth) VerifyLink(_ context.Context, _ string) (service.Account, string, error) {
	return accountA, tokenA, f.verifyErr
}

func (f *fakeAuth) Authenticate(_ context.Context, token string) (service.Account, bool, error) {
	switch token {
	case tokenA:
		return accountA, f.extended, nil
	case tokenB:
		return accountB, f.extended, nil
	}
	return service.Account{}, false, service.ErrUnauthorized
}

func (f *fakeAuth) Logout(_ context.Context, token string) error {
	f.loggedOut = token
	return nil
}

func (f *fakeAuth) DeleteAccount(_ context.Context, id int64) error {
	f.deletedID = id
	return nil
}

// call envoie une requête au routeur complet, depuis une IP donnée.
func call(auth authService, method, target, body string, header map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	for k, v := range header {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	NewRouter(func(context.Context) error { return nil }, nil, auth, nil).ServeHTTP(rec, req)
	return rec
}

func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body errorResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatalf("corps d'erreur illisible : %v", err)
	}
	return body.Error
}

func TestRequestLogin(t *testing.T) {
	t.Run("acceptée : 202", func(t *testing.T) {
		auth := &fakeAuth{}
		rec := call(auth, http.MethodPost, "/auth/login", `{"email":"Parent@Example.com"}`, nil)
		if rec.Code != http.StatusAccepted || auth.requested != "Parent@Example.com" {
			t.Errorf("code %d, adresse transmise %q", rec.Code, auth.requested)
		}
	})

	for _, tt := range []struct {
		name, body string
	}{
		{"champ inconnu", `{"email":"a@b.fr","admin":true}`},
		{"adresse absente", `{}`},
		{"données après l'objet", `{"email":"a@b.fr"}{"email":"c@d.fr"}`},
		{"pas du JSON", `email=a@b.fr`},
		{"corps trop grand", `{"email":"` + strings.Repeat("a", maxBodyBytes) + `@b.fr"}`},
	} {
		t.Run(tt.name+" : 400 invalid_request", func(t *testing.T) {
			auth := &fakeAuth{}
			rec := call(auth, http.MethodPost, "/auth/login", tt.body, nil)
			if rec.Code != http.StatusBadRequest || errorCode(t, rec) != "invalid_request" || auth.requested != "" {
				t.Errorf("code %d, service appelé avec %q", rec.Code, auth.requested)
			}
		})
	}

	for _, tt := range []struct {
		err      error
		wantCode int
		wantErr  string
	}{
		{service.ErrInvalidEmail, http.StatusBadRequest, "invalid_email"},
		{service.ErrTooManyRequests, http.StatusTooManyRequests, "too_many_requests"},
		{service.ErrMailQuota, http.StatusServiceUnavailable, "unavailable"},
		{errors.New("panne"), http.StatusInternalServerError, "internal"},
	} {
		t.Run(tt.wantErr, func(t *testing.T) {
			rec := call(&fakeAuth{requestErr: tt.err}, http.MethodPost, "/auth/login", `{"email":"a@b.fr"}`, nil)
			if rec.Code != tt.wantCode || errorCode(t, rec) != tt.wantErr {
				t.Errorf("code %d", rec.Code)
			}
			if tt.wantCode == http.StatusTooManyRequests && rec.Header().Get("Retry-After") != "3600" {
				t.Errorf("Retry-After = %q", rec.Header().Get("Retry-After"))
			}
		})
	}
}

func TestVerifyCodeOpensASessionForEachClient(t *testing.T) {
	t.Run("PWA : cookie HttpOnly, pas de jeton dans la réponse", func(t *testing.T) {
		rec := call(&fakeAuth{}, http.MethodPost, "/auth/code", `{"email":"a@example.com","code":"042917","client":"web"}`, nil)
		if rec.Code != http.StatusOK {
			t.Fatalf("code %d", rec.Code)
		}
		cookie := rec.Header().Get("Set-Cookie")
		for _, want := range []string{"__Host-rawi_session=" + tokenA, "Path=/", "Max-Age=15552000", "HttpOnly", "Secure", "SameSite=Lax"} {
			if !strings.Contains(cookie, want) {
				t.Errorf("Set-Cookie sans %q : %q", want, cookie)
			}
		}
		if strings.Contains(cookie, "Domain=") {
			t.Errorf("cookie avec Domain : %q", cookie)
		}
		var body map[string]any
		if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if _, ok := body["token"]; ok {
			t.Errorf("jeton renvoyé à la PWA : %v", body)
		}
	})

	t.Run("app : jeton dans la réponse, pas de cookie", func(t *testing.T) {
		rec := call(&fakeAuth{}, http.MethodPost, "/auth/link", `{"token":"`+tokenB+`","client":"app"}`, nil)
		var body sessionResponse
		if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if rec.Code != http.StatusOK || body.Token != tokenA || body.Account.Email != "a@example.com" {
			t.Errorf("code %d, réponse %+v", rec.Code, body)
		}
		if rec.Header().Get("Set-Cookie") != "" {
			t.Error("cookie posé pour l'app")
		}
	})

	t.Run("code refusé : 400 invalid_code", func(t *testing.T) {
		rec := call(&fakeAuth{verifyErr: service.ErrInvalidCode}, http.MethodPost, "/auth/code", `{"email":"a@example.com","code":"042917","client":"web"}`, nil)
		if rec.Code != http.StatusBadRequest || errorCode(t, rec) != "invalid_code" || rec.Header().Get("Set-Cookie") != "" {
			t.Errorf("code %d", rec.Code)
		}
	})

	for _, body := range []string{
		`{"email":"a@example.com","code":"42917","client":"web"}`,
		`{"email":"a@example.com","code":"abcdef","client":"web"}`,
		`{"email":"a@example.com","code":"042917","client":"autre"}`,
		`{"email":"","code":"042917","client":"web"}`,
	} {
		rec := call(&fakeAuth{}, http.MethodPost, "/auth/code", body, nil)
		if rec.Code != http.StatusBadRequest || errorCode(t, rec) != "invalid_request" {
			t.Errorf("%s : code %d", body, rec.Code)
		}
	}
	rec := call(&fakeAuth{}, http.MethodPost, "/auth/link", `{"token":"court","client":"web"}`, nil)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("jeton mal formé : code %d", rec.Code)
	}
}

// Chaque route de niveau « compte » : 401 sans session, et le compte de la session seulement (A ne voit pas B).
func TestAccountRoutesRequireASessionAndStayOnItsAccount(t *testing.T) {
	routes := []struct{ method, target string }{
		{http.MethodPost, "/auth/logout"},
		{http.MethodGet, "/account"},
		{http.MethodDelete, "/account"},
	}
	for _, route := range routes {
		for name, header := range map[string]map[string]string{
			"sans session":        nil,
			"jeton inconnu":       {"Authorization": "Bearer " + strings.Repeat("C", 43)},
			"jeton mal formé":     {"Authorization": "Bearer court"},
			"pas un Bearer":       {"Authorization": "Basic " + tokenA},
			"cookie mal formé":    {"Cookie": sessionCookie + "=court"},
			"cookie d'un inconnu": {"Cookie": sessionCookie + "=" + strings.Repeat("C", 43)},
		} {
			auth := &fakeAuth{}
			rec := call(auth, route.method, route.target, "", header)
			if rec.Code != http.StatusUnauthorized || errorCode(t, rec) != "unauthorized" {
				t.Errorf("%s %s, %s : code %d", route.method, route.target, name, rec.Code)
			}
			if auth.loggedOut != "" || auth.deletedID != 0 {
				t.Errorf("%s %s, %s : action faite sans session", route.method, route.target, name)
			}
		}
	}

	for token, want := range map[string]service.Account{tokenA: accountA, tokenB: accountB} {
		rec := call(&fakeAuth{}, http.MethodGet, "/account", "", map[string]string{"Authorization": "Bearer " + token})
		var body accountResponse
		if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
			t.Fatal(err)
		}
		if rec.Code != http.StatusOK || body.Email != want.Email {
			t.Errorf("GET /account avec le jeton de %s : %d %+v", want.Email, rec.Code, body)
		}

		auth := &fakeAuth{}
		call(auth, http.MethodDelete, "/account", "", map[string]string{"Cookie": sessionCookie + "=" + token})
		if auth.deletedID != want.ID {
			t.Errorf("DELETE /account avec la session de %s supprime le compte %d", want.Email, auth.deletedID)
		}
	}
}

func TestSessionCookieIsRefreshedAndCleared(t *testing.T) {
	cookie := map[string]string{"Cookie": sessionCookie + "=" + tokenA}

	rec := call(&fakeAuth{extended: true}, http.MethodGet, "/account", "", cookie)
	if !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=15552000") {
		t.Errorf("session prolongée sans nouveau cookie : %q", rec.Header().Get("Set-Cookie"))
	}
	rec = call(&fakeAuth{extended: true}, http.MethodGet, "/account", "", map[string]string{"Authorization": "Bearer " + tokenA})
	if rec.Header().Get("Set-Cookie") != "" {
		t.Error("cookie posé pour l'app mobile")
	}

	auth := &fakeAuth{}
	rec = call(auth, http.MethodPost, "/auth/logout", "", cookie)
	if rec.Code != http.StatusNoContent || auth.loggedOut != tokenA || !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
		t.Errorf("déconnexion : code %d, jeton %q, Set-Cookie %q", rec.Code, auth.loggedOut, rec.Header().Get("Set-Cookie"))
	}

	rec = call(&fakeAuth{}, http.MethodGet, "/account", "", map[string]string{"Cookie": sessionCookie + "=" + strings.Repeat("C", 43)})
	if !strings.Contains(rec.Header().Get("Set-Cookie"), "Max-Age=0") {
		t.Errorf("cookie d'une session inconnue gardé : %q", rec.Header().Get("Set-Cookie"))
	}
}

func TestLoginIsLimitedPerIP(t *testing.T) {
	// Un seul routeur : les limites vivent dans ses limiteurs.
	router := NewRouter(func(context.Context) error { return nil }, nil, &fakeAuth{}, nil)
	send := func(remoteAddr, forwardedFor string) int {
		req := httptest.NewRequest(http.MethodPost, "/auth/login", strings.NewReader(`{"email":"a@b.fr"}`))
		req.RemoteAddr = remoteAddr
		if forwardedFor != "" {
			req.Header.Set("X-Forwarded-For", forwardedFor)
		}
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec.Code
	}

	// Derrière Caddy (connexion locale) : l'IP du client est la dernière de X-Forwarded-For.
	for i := range loginRequestsPerIP {
		if code := send("127.0.0.1:50000", "203.0.113.7"); code != http.StatusAccepted {
			t.Fatalf("demande %d : %d", i+1, code)
		}
	}
	if code := send("127.0.0.1:50000", "203.0.113.7"); code != http.StatusTooManyRequests {
		t.Errorf("demande au-delà de la limite : %d", code)
	}
	// Une IP inventée par le client avant celle ajoutée par Caddy ne change rien.
	if code := send("127.0.0.1:50000", "198.51.100.1, 203.0.113.7"); code != http.StatusTooManyRequests {
		t.Errorf("contournement par un X-Forwarded-For forgé : %d", code)
	}
	if code := send("127.0.0.1:50000", "203.0.113.8"); code != http.StatusAccepted {
		t.Errorf("une autre IP est bloquée : %d", code)
	}
	// Hors de la machine, X-Forwarded-For est ignoré : c'est l'adresse de la connexion qui compte.
	for range loginRequestsPerIP {
		send("192.0.2.1:40000", "")
	}
	if code := send("192.0.2.1:40000", "203.0.113.99"); code != http.StatusTooManyRequests {
		t.Errorf("X-Forwarded-For cru venant d'une IP extérieure : %d", code)
	}
}

func TestCrossOriginRefusesOtherSites(t *testing.T) {
	const app = "https://app.rawiaudio.com"
	protect, err := CrossOrigin(app)
	if err != nil {
		t.Fatal(err)
	}
	handler := protect(NewRouter(func(context.Context) error { return nil }, nil, &fakeAuth{}, nil))
	send := func(header map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "https://api.rawiaudio.com/auth/login", strings.NewReader(`{"email":"a@b.fr"}`))
		for k, v := range header {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
		return rec
	}

	rec := send(map[string]string{"Origin": "https://rawiaudio.com", "Sec-Fetch-Site": "same-site"})
	if rec.Code != http.StatusForbidden || errorCode(t, rec) != "forbidden" {
		t.Errorf("le site vitrine (même site) : %d", rec.Code)
	}
	if rec := send(map[string]string{"Origin": "https://pirate.example", "Sec-Fetch-Site": "cross-site"}); rec.Code != http.StatusForbidden {
		t.Errorf("un autre site : %d", rec.Code)
	}
	if rec := send(map[string]string{"Origin": app, "Sec-Fetch-Site": "same-site"}); rec.Code != http.StatusAccepted {
		t.Errorf("la PWA : %d", rec.Code)
	}
	if rec := send(nil); rec.Code != http.StatusAccepted {
		t.Errorf("l'app mobile (sans Origin) : %d", rec.Code)
	}
	if _, err := CrossOrigin("pas une origine"); err == nil {
		t.Error("origine invalide acceptée")
	}
}

// fakeHistory note le compte et les épisodes reçus, et renvoie ce qu'on lui donne.
type fakeHistory struct {
	accountID int64
	got       []string
	answer    []string
}

func (f *fakeHistory) Sync(_ context.Context, accountID int64, episodeIDs []string) ([]string, error) {
	f.accountID, f.got = accountID, episodeIDs
	return f.answer, nil
}

func TestSyncHistory(t *testing.T) {
	send := func(history *fakeHistory, body string, header map[string]string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/account/history", strings.NewReader(body))
		for k, v := range header {
			req.Header.Set(k, v)
		}
		rec := httptest.NewRecorder()
		NewRouter(func(context.Context) error { return nil }, nil, &fakeAuth{}, history).ServeHTTP(rec, req)
		return rec
	}
	bearer := func(token string) map[string]string { return map[string]string{"Authorization": "Bearer " + token} }

	history := &fakeHistory{}
	if rec := send(history, `{"episodeIds":["fr-001"]}`, nil); rec.Code != http.StatusUnauthorized || history.got != nil {
		t.Errorf("sans session : %d, service appelé avec %v", rec.Code, history.got)
	}

	// Le compte vient de la session : B synchronise toujours l'historique de B.
	history = &fakeHistory{answer: []string{"fr-001", "fr-002"}}
	rec := send(history, `{"episodeIds":["fr-002"]}`, bearer(tokenB))
	var body historyResponse
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if rec.Code != http.StatusOK || history.accountID != accountB.ID || len(body.EpisodeIDs) != 2 {
		t.Errorf("code %d, compte %d, réponse %+v", rec.Code, history.accountID, body)
	}

	// Historique vide : [] et jamais null, que le client lit comme une liste.
	rec = send(&fakeHistory{answer: []string{}}, `{"episodeIds":[]}`, bearer(tokenA))
	if got := strings.TrimSpace(rec.Body.String()); got != `{"episodeIds":[]}` {
		t.Errorf("historique vide : %s", got)
	}

	tooMany := `{"episodeIds":["` + strings.TrimSuffix(strings.Repeat(`fr-001","`, maxHeardEpisodes+1), `","`) + `"]}`
	for name, body := range map[string]string{
		"liste absente":       `{}`,
		"identifiant inventé": `{"episodeIds":["../../etc"]}`,
		"autre forme":         `{"episodeIds":["fr-1"]}`,
		"trop d'épisodes":     tooMany,
		"champ inconnu":       `{"episodeIds":[],"accountId":2}`,
	} {
		history := &fakeHistory{}
		if rec := send(history, body, bearer(tokenA)); rec.Code != http.StatusBadRequest || history.got != nil {
			t.Errorf("%s : code %d", name, rec.Code)
		}
	}
}
