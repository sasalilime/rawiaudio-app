// Package httpapi contient les handlers et middlewares HTTP de l'API.
package httpapi

import (
	"context"
	"net/http"
)

// NewRouter déclare toutes les routes de l'API, chacune avec son niveau d'accès.
// Une route absente d'ici n'existe pas : le ServeMux répond 404.
func NewRouter(ping func(context.Context) error) http.Handler {
	mux := http.NewServeMux()

	// ponytail: niveau d'accès en commentaire tant qu'aucune route n'est protégée ;
	// un wrapper par niveau arrive avec la première route protégée.

	// Accès : public.
	mux.Handle("GET /health", health(ping))

	return mux
}
