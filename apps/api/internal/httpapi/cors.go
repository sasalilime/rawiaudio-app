package httpapi

import "net/http"

// CORS autorise une seule origine (la PWA, https://app.rawiaudio.com) à lire les réponses de l'API.
// allowedOrigin vide : aucun en-tête CORS, comme en dev où Vite relaie /api sur la même origine.
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// La réponse dépend de l'en-tête Origin : un cache partagé ne doit pas la resservir à une autre origine.
			w.Header().Add("Vary", "Origin")
			allowed := allowedOrigin != "" && r.Header.Get("Origin") == allowedOrigin
			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			}

			// Requête préalable du navigateur (preflight). Nos appels sont des GET simples et n'en déclenchent pas,
			// mais un en-tête ajouté un jour côté PWA en déclencherait une : on y répond plutôt que de renvoyer 405.
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				if allowed {
					w.Header().Set("Access-Control-Allow-Methods", "GET")
					w.Header().Set("Access-Control-Allow-Headers", "Accept")
					w.Header().Set("Access-Control-Max-Age", "86400")
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
