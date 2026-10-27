package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCORS(t *testing.T) {
	const app = "https://app.rawiaudio.com"
	ok := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })

	tests := []struct {
		name        string
		allowed     string
		method      string
		origin      string
		preflight   bool
		wantCode    int
		wantOrigin  string
		wantMethods string
	}{
		{name: "origine autorisée", allowed: app, method: http.MethodGet, origin: app, wantCode: 200, wantOrigin: app},
		{name: "autre origine : pas d'autorisation", allowed: app, method: http.MethodGet, origin: "https://exemple.com", wantCode: 200},
		{name: "sans origine (curl, même origine)", allowed: app, method: http.MethodGet, wantCode: 200},
		{name: "CORS désactivé en dev", allowed: "", method: http.MethodGet, origin: app, wantCode: 200},
		{name: "preflight autorisé", allowed: app, method: http.MethodOptions, origin: app, preflight: true, wantCode: 204, wantOrigin: app, wantMethods: "GET, POST, DELETE"},
		{name: "preflight d'une autre origine", allowed: app, method: http.MethodOptions, origin: "https://exemple.com", preflight: true, wantCode: 204},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, "/episodes?lang=fr", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			if tt.preflight {
				req.Header.Set("Access-Control-Request-Method", "GET")
			}
			rec := httptest.NewRecorder()

			CORS(tt.allowed)(ok).ServeHTTP(rec, req)

			if rec.Code != tt.wantCode {
				t.Errorf("code = %d, attendu %d", rec.Code, tt.wantCode)
			}
			if got := rec.Header().Get("Access-Control-Allow-Origin"); got != tt.wantOrigin {
				t.Errorf("Allow-Origin = %q, attendu %q", got, tt.wantOrigin)
			}
			if got := rec.Header().Get("Access-Control-Allow-Methods"); got != tt.wantMethods {
				t.Errorf("Allow-Methods = %q, attendu %q", got, tt.wantMethods)
			}
			if got := rec.Header().Get("Vary"); got != "Origin" {
				t.Errorf("Vary = %q, attendu Origin", got)
			}
		})
	}
}
