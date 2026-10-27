// Package httpapi contient les handlers et middlewares HTTP de l'API.
package httpapi

import (
	"context"
	"net/http"
	"time"
)

// Limites par IP des routes de connexion (ADR-0012), en plus des limites par adresse du service.
const (
	loginRequestsPerIP  = 10 // e-mails demandés par heure
	verifyRequestsPerIP = 30 // codes ou liens vérifiés par heure
)

// NewRouter déclare toutes les routes de l'API, chacune avec son niveau d'accès :
//   - public : rien à vérifier ;
//   - compte : requireAccount, sinon 401.
//
// Une route absente d'ici n'existe pas : le ServeMux répond 404.
func NewRouter(ping func(context.Context) error, catalog catalogReader, auth authService) http.Handler {
	mux := http.NewServeMux()
	account := func(next http.Handler) http.Handler { return requireAccount(auth, next) }
	loginLimit := newIPLimiter(loginRequestsPerIP, time.Hour)
	verifyLimit := newIPLimiter(verifyRequestsPerIP, time.Hour)

	// Accès : public.
	mux.Handle("GET /health", health(ping))

	// Accès : public (le catalogue est gratuit tant que l'abonnement n'existe pas).
	mux.Handle("GET /episodes", listEpisodes(catalog))
	mux.Handle("GET /episodes/{id}", getEpisode(catalog))
	// Accès : public pour l'instant ; l'abonnement se vérifiera dans service.Catalog.AudioURL.
	mux.Handle("GET /episodes/{id}/audio", getEpisodeAudio(catalog))

	// Accès : public, limité par IP. S'inscrire = se connecter (ADR-0012).
	mux.Handle("POST /auth/login", loginLimit.middleware(requestLogin(auth)))
	mux.Handle("POST /auth/code", verifyLimit.middleware(verifyCode(auth)))
	mux.Handle("POST /auth/link", verifyLimit.middleware(verifyLink(auth)))

	// Accès : compte.
	mux.Handle("POST /auth/logout", account(logout(auth)))
	mux.Handle("GET /account", account(getAccount()))
	mux.Handle("DELETE /account", account(deleteAccount(auth)))

	return mux
}
