package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
)

// errorResponse suit le schéma Error de contracts/openapi.yaml : un code, jamais de détail interne.
type errorResponse struct {
	Error string `json:"error"`
}

// writeJSON pose l'en-tête avant WriteHeader : en Go, un en-tête posé après est ignoré sans erreur.
func writeJSON(w http.ResponseWriter, r *http.Request, code int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		slog.WarnContext(r.Context(), "écriture de la réponse", "path", r.URL.Path, "err", err)
	}
}

func writeError(w http.ResponseWriter, r *http.Request, code int, errorCode string) {
	writeJSON(w, r, code, errorResponse{Error: errorCode})
}
