package httpapi

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"
)

// healthResponse suit le schéma Health de contracts/openapi.yaml.
type healthResponse struct {
	Status string `json:"status"`
}

// health répond 200 si Postgres répond au ping, 503 sinon.
// ping est une fonction et non une interface : en test, on passe une fausse fonction.
func health(ping func(context.Context) error) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()

		code, body := http.StatusOK, healthResponse{Status: "ok"}
		if err := ping(ctx); err != nil {
			slog.WarnContext(ctx, "postgres injoignable", "err", err)
			code, body = http.StatusServiceUnavailable, healthResponse{Status: "unavailable"}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		if err := json.NewEncoder(w).Encode(body); err != nil {
			slog.WarnContext(ctx, "écriture de la réponse /health", "err", err)
		}
	}
}
