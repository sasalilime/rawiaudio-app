package httpapi

import "net/http"

// CORS autorise une seule origine (la PWA, https://app.rawiaudio.com) à appeler l'API et à lire ses réponses,
// cookie de session compris (ADR-0012). allowedOrigin vide : aucun en-tête CORS, comme en dev où Vite relaie
// /api sur la même origine.
func CORS(allowedOrigin string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// La réponse dépend de l'en-tête Origin : un cache partagé ne doit pas la resservir à une autre origine.
			w.Header().Add("Vary", "Origin")
			allowed := allowedOrigin != "" && r.Header.Get("Origin") == allowedOrigin
			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
				// Le navigateur n'envoie le cookie de session (credentials "include") qu'avec cet accord explicite.
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				// La PWA lit Retry-After d'une réponse 429 pour dire combien de temps attendre.
				w.Header().Set("Access-Control-Expose-Headers", "Retry-After")
			}

			// Requête préalable du navigateur (preflight) : un POST en JSON ou un DELETE en déclenchent une.
			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				if allowed {
					w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE")
					w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Authorization")
					w.Header().Set("Access-Control-Max-Age", "86400")
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
