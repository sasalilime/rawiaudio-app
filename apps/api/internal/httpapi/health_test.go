package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHealth(t *testing.T) {
	tests := []struct {
		name       string
		ping       func(context.Context) error
		wantCode   int
		wantStatus string
	}{
		{
			name:       "postgres répond",
			ping:       func(context.Context) error { return nil },
			wantCode:   http.StatusOK,
			wantStatus: "ok",
		},
		{
			name:       "postgres injoignable",
			ping:       func(context.Context) error { return errors.New("connexion refusée") },
			wantCode:   http.StatusServiceUnavailable,
			wantStatus: "unavailable",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// On passe par NewRouter pour tester aussi l'enregistrement de la route.
			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodGet, "/health", nil)
			NewRouter(tt.ping, nil, nil, nil).ServeHTTP(rec, req) // /health n'utilise ni le catalogue ni la connexion

			if rec.Code != tt.wantCode {
				t.Errorf("code = %d, attendu %d", rec.Code, tt.wantCode)
			}
			if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
				t.Errorf("Content-Type = %q, attendu application/json", ct)
			}
			var body healthResponse
			if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
				t.Fatalf("corps JSON illisible : %v", err)
			}
			if body.Status != tt.wantStatus {
				t.Errorf("status = %q, attendu %q", body.Status, tt.wantStatus)
			}
		})
	}
}
