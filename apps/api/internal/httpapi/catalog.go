package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"regexp"
	"slices"
	"time"

	"rawiaudio.com/api/internal/service"
)

// catalogReader est implémenté par service.Catalog. En test, un faux catalogue le remplace.
type catalogReader interface {
	Episodes(ctx context.Context, lang string) ([]service.EpisodeSummary, error)
	Episode(ctx context.Context, id string) (service.Episode, error)
	AudioURL(ctx context.Context, id string) (service.AudioURL, error)
}

// Réponses JSON : elles suivent les schémas de contracts/openapi.yaml, champ par champ.

type seriesRefResponse struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Part  int    `json:"part"`
}

type themeRefResponse struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Position int    `json:"position"`
}

type episodeSummaryResponse struct {
	ID              string             `json:"id"`
	Number          int                `json:"number"`
	Slug            string             `json:"slug"`
	Title           string             `json:"title"`
	Reference       string             `json:"reference"`
	DurationSeconds int                `json:"durationSeconds"`
	PublishedAt     *time.Time         `json:"publishedAt"`
	Series          *seriesRefResponse `json:"series"`   // null pour un épisode hors série
	Themes          []themeRefResponse `json:"themes"`   // [] et jamais null
	ImageURL        *string            `json:"imageUrl"` // null sans illustration (ADR-0009)
}

type sourceResponse struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

// episodeResponse : la struct embarquée sans tag json voit ses champs remontés au même niveau.
type episodeResponse struct {
	episodeSummaryResponse
	Summary []string         `json:"summary"`
	Sources []sourceResponse `json:"sources"`
}

type episodeListResponse struct {
	Episodes []episodeSummaryResponse `json:"episodes"`
}

type audioURLResponse struct {
	URL       string    `json:"url"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// listEpisodesRequest : la requête de GET /episodes, validée avant tout appel au service.
type listEpisodesRequest struct {
	Lang string
}

func (req listEpisodesRequest) Validate() error {
	if !slices.Contains([]string{"fr", "ar", "en"}, req.Lang) {
		return errors.New("lang doit valoir fr, ar ou en")
	}
	return nil
}

func listEpisodes(catalog catalogReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		req := listEpisodesRequest{Lang: r.URL.Query().Get("lang")}
		if err := req.Validate(); err != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_request")
			return
		}

		episodes, err := catalog.Episodes(r.Context(), req.Lang)
		if err != nil {
			slog.ErrorContext(r.Context(), "liste des épisodes", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
			return
		}

		body := episodeListResponse{Episodes: make([]episodeSummaryResponse, 0, len(episodes))}
		for _, episode := range episodes {
			body.Episodes = append(body.Episodes, toSummaryResponse(episode))
		}
		writeJSON(w, r, http.StatusOK, body)
	}
}

// episodeID : forme des identifiants publics (langue et numéro sur 3 chiffres, contrainte de la base).
// Un identifiant d'une autre forme donne 404 sans atteindre la base : un octet invalide
// en UTF-8 y provoquerait une erreur 500, et une longue ligne d'erreur dans les journaux.
var episodeID = regexp.MustCompile(`^(fr|ar|en)-[0-9]{3}$`)

// getEpisode : l'identifiant part en paramètre SQL ; inconnu ou mal formé, il donne 404.
func getEpisode(catalog catalogReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !episodeID.MatchString(r.PathValue("id")) {
			writeError(w, r, http.StatusNotFound, "not_found")
			return
		}
		episode, err := catalog.Episode(r.Context(), r.PathValue("id"))
		if errors.Is(err, service.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "not_found")
			return
		}
		if err != nil {
			slog.ErrorContext(r.Context(), "fiche d'un épisode", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
			return
		}
		writeJSON(w, r, http.StatusOK, toEpisodeResponse(episode))
	}
}

// getEpisodeAudio renvoie une URL signée, différente à chaque appel : aucun cache ne doit la garder.
func getEpisodeAudio(catalog catalogReader) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "no-store")
		if !episodeID.MatchString(r.PathValue("id")) {
			writeError(w, r, http.StatusNotFound, "not_found")
			return
		}
		audio, err := catalog.AudioURL(r.Context(), r.PathValue("id"))
		if errors.Is(err, service.ErrNotFound) {
			writeError(w, r, http.StatusNotFound, "not_found")
			return
		}
		if err != nil {
			slog.ErrorContext(r.Context(), "URL audio d'un épisode", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
			return
		}
		writeJSON(w, r, http.StatusOK, audioURLResponse{URL: audio.URL, ExpiresAt: audio.ExpiresAt.UTC()})
	}
}

func toSummaryResponse(episode service.EpisodeSummary) episodeSummaryResponse {
	response := episodeSummaryResponse{
		ID:              episode.ID,
		Number:          episode.Number,
		Slug:            episode.Slug,
		Title:           episode.Title,
		Reference:       episode.Reference,
		DurationSeconds: episode.DurationSeconds,
		Themes:          make([]themeRefResponse, 0, len(episode.Themes)),
		ImageURL:        episode.ImageURL,
	}
	for _, theme := range episode.Themes {
		response.Themes = append(response.Themes, themeRefResponse{ID: theme.ID, Title: theme.Title, Position: theme.Position})
	}
	if episode.PublishedAt != nil {
		// pgx rend l'heure dans le fuseau de la machine : toujours UTC dans l'API, quel que soit le serveur.
		utc := episode.PublishedAt.UTC()
		response.PublishedAt = &utc
	}
	if episode.Series != nil {
		response.Series = &seriesRefResponse{ID: episode.Series.ID, Title: episode.Series.Title, Part: episode.Series.Part}
	}
	return response
}

func toEpisodeResponse(episode service.Episode) episodeResponse {
	response := episodeResponse{
		episodeSummaryResponse: toSummaryResponse(episode.EpisodeSummary),
		Summary:                append([]string{}, episode.Summary...), // jamais nil : [] et non null en JSON
		Sources:                make([]sourceResponse, 0, len(episode.Sources)),
	}
	for _, source := range episode.Sources {
		response.Sources = append(response.Sources, sourceResponse{Label: source.Label, URL: source.URL})
	}
	return response
}
