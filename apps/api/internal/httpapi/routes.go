// Package httpapi contient les handlers et middlewares HTTP de l'API.
package httpapi

import (
	"context"
	"net/http"
)

// NewRouter déclare toutes les routes de l'API, chacune avec son niveau d'accès.
// Une route absente d'ici n'existe pas : le ServeMux répond 404.
func NewRouter(ping func(context.Context) error, catalog catalogReader) http.Handler {
	mux := http.NewServeMux()

	// ponytail: niveau d'accès en commentaire tant qu'aucune route n'est protégée ;
	// un wrapper par niveau arrive avec la première route protégée.

	// Accès : public.
	mux.Handle("GET /health", health(ping))

	// Accès : public (le catalogue est gratuit tant que l'abonnement n'existe pas).
	mux.Handle("GET /episodes", listEpisodes(catalog))
	mux.Handle("GET /episodes/{id}", getEpisode(catalog))
	// Accès : public pour l'instant ; l'abonnement se vérifiera dans service.Catalog.AudioURL.
	mux.Handle("GET /episodes/{id}/audio", getEpisodeAudio(catalog))

	return mux
}
