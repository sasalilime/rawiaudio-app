package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
	"time"

	"rawiaudio.com/api/internal/service"
)

// fakeCatalog remplace service.Catalog : il renvoie ce qu'on lui donne.
type fakeCatalog struct {
	episodes []service.EpisodeSummary
	episode  service.Episode
	audio    service.AudioURL
	err      error
}

func (f fakeCatalog) Episodes(context.Context, string) ([]service.EpisodeSummary, error) {
	return f.episodes, f.err
}

func (f fakeCatalog) Episode(context.Context, string) (service.Episode, error) {
	return f.episode, f.err
}

func (f fakeCatalog) AudioURL(context.Context, string) (service.AudioURL, error) {
	return f.audio, f.err
}

// Heure de Paris : la réponse doit la ramener en UTC.
var paris = time.FixedZone("Paris", 2*60*60)
var publishedAt = time.Date(2026, 10, 16, 2, 0, 0, 0, paris)

var imageURL = "https://media.rawiaudio.com/fr/001-un/image-16x9.webp"

var episodeOne = service.EpisodeSummary{
	ID: "fr-001", Number: 1, Slug: "un", Title: "Un", Reference: "Réf 1", DurationSeconds: 392,
	PublishedAt: &publishedAt,
	Series:      &service.SeriesRef{ID: "fr-al-kahf", Title: "Al-Kahf", Part: 1},
	Themes:      []service.ThemeRef{{ID: "fr-histoires-du-coran", Title: "Histoires du Coran", Position: 1}},
	ImageURL:    &imageURL,
}

const episodeOneJSON = `{"id": "fr-001", "number": 1, "slug": "un", "title": "Un", "reference": "Réf 1",
	"durationSeconds": 392, "publishedAt": "2026-10-16T00:00:00Z", "series": {"id": "fr-al-kahf", "title": "Al-Kahf", "part": 1},
	"themes": [{"id": "fr-histoires-du-coran", "title": "Histoires du Coran", "position": 1}],
	"imageUrl": "https://media.rawiaudio.com/fr/001-un/image-16x9.webp"}`

// serve passe par NewRouter pour tester aussi le routage et la lecture de {id}.
func serve(catalog catalogReader, target string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	NewRouter(func(context.Context) error { return nil }, catalog).
		ServeHTTP(rec, httptest.NewRequest(http.MethodGet, target, nil))
	return rec
}

// assertJSON compare le JSON reçu au JSON attendu, sans tenir compte des espaces ni de l'ordre des clés.
func assertJSON(t *testing.T, rec *httptest.ResponseRecorder, wantCode int, wantBody string) {
	t.Helper()
	if rec.Code != wantCode {
		t.Errorf("code = %d, attendu %d", rec.Code, wantCode)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, attendu application/json", ct)
	}
	var got, want any
	if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
		t.Fatalf("réponse illisible %q : %v", rec.Body.String(), err)
	}
	if err := json.Unmarshal([]byte(wantBody), &want); err != nil {
		t.Fatalf("JSON attendu illisible : %v", err)
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("corps = %s\nattendu   %s", rec.Body.String(), wantBody)
	}
}

func TestListEpisodes(t *testing.T) {
	tests := []struct {
		name     string
		target   string
		catalog  fakeCatalog
		wantCode int
		wantBody string
	}{
		{
			name:     "épisodes publiés",
			target:   "/episodes?lang=fr",
			catalog:  fakeCatalog{episodes: []service.EpisodeSummary{episodeOne}},
			wantCode: http.StatusOK,
			wantBody: `{"episodes": [` + episodeOneJSON + `]}`,
		},
		{
			name:     "aucun épisode : liste vide et non null",
			target:   "/episodes?lang=ar",
			catalog:  fakeCatalog{episodes: nil},
			wantCode: http.StatusOK,
			wantBody: `{"episodes": []}`,
		},
		{
			name:     "lang absent",
			target:   "/episodes",
			wantCode: http.StatusBadRequest,
			wantBody: `{"error": "invalid_request"}`,
		},
		{
			name:     "lang inconnu",
			target:   "/episodes?lang=de",
			wantCode: http.StatusBadRequest,
			wantBody: `{"error": "invalid_request"}`,
		},
		{
			name:     "erreur interne, sans détail",
			target:   "/episodes?lang=fr",
			catalog:  fakeCatalog{err: errors.New("mot de passe refusé pour rawi")},
			wantCode: http.StatusInternalServerError,
			wantBody: `{"error": "internal"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertJSON(t, serve(tt.catalog, tt.target), tt.wantCode, tt.wantBody)
		})
	}
}

func TestGetEpisode(t *testing.T) {
	withoutSeries := episodeOne
	withoutSeries.Series = nil
	withoutSeries.Themes = nil   // aucun thème : [] attendu, jamais null
	withoutSeries.ImageURL = nil // sans illustration : null attendu, jamais un champ absent

	tests := []struct {
		name     string
		catalog  fakeCatalog
		wantCode int
		wantBody string
	}{
		{
			name: "fiche complète",
			catalog: fakeCatalog{episode: service.Episode{
				EpisodeSummary: episodeOne,
				Summary:        []string{"premier", "second"},
				Sources:        []service.Source{{Label: "تفسير السعدي", URL: "https://shamela.ws/book/42/474"}},
			}},
			wantCode: http.StatusOK,
			wantBody: strings.TrimSuffix(episodeOneJSON, "}") + `, "summary": ["premier", "second"],
				"sources": [{"label": "تفسير السعدي", "url": "https://shamela.ws/book/42/474"}]}`,
		},
		{
			name:     "hors série, sans illustration, résumé ni source : null et listes vides",
			catalog:  fakeCatalog{episode: service.Episode{EpisodeSummary: withoutSeries}},
			wantCode: http.StatusOK,
			wantBody: strings.NewReplacer(
				`{"id": "fr-al-kahf", "title": "Al-Kahf", "part": 1}`, "null",
				`[{"id": "fr-histoires-du-coran", "title": "Histoires du Coran", "position": 1}]`, "[]",
				`"`+imageURL+`"`, "null",
			).Replace(strings.TrimSuffix(episodeOneJSON, "}")) + `, "summary": [], "sources": []}`,
		},
		{
			name:     "inconnu ou pas encore publié",
			catalog:  fakeCatalog{err: fmt.Errorf("épisode fr-002: %w", service.ErrNotFound)},
			wantCode: http.StatusNotFound,
			wantBody: `{"error": "not_found"}`,
		},
		{
			name:     "erreur interne, sans détail",
			catalog:  fakeCatalog{err: errors.New("connexion refusée")},
			wantCode: http.StatusInternalServerError,
			wantBody: `{"error": "internal"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assertJSON(t, serve(tt.catalog, "/episodes/fr-001"), tt.wantCode, tt.wantBody)
		})
	}
}

func TestGetEpisodeAudio(t *testing.T) {
	tests := []struct {
		name     string
		catalog  fakeCatalog
		wantCode int
		wantBody string
	}{
		{
			name: "URL signée, expiration ramenée en UTC",
			catalog: fakeCatalog{audio: service.AudioURL{
				URL:       "https://compte.eu.r2.cloudflarestorage.com/rawi-audio/fr/001-un/audio-128.mp3?X-Amz-Signature=abc",
				ExpiresAt: publishedAt,
			}},
			wantCode: http.StatusOK,
			wantBody: `{"url": "https://compte.eu.r2.cloudflarestorage.com/rawi-audio/fr/001-un/audio-128.mp3?X-Amz-Signature=abc",
				"expiresAt": "2026-10-16T00:00:00Z"}`,
		},
		{
			name:     "inconnu ou pas encore publié",
			catalog:  fakeCatalog{err: fmt.Errorf("épisode fr-002: %w", service.ErrNotFound)},
			wantCode: http.StatusNotFound,
			wantBody: `{"error": "not_found"}`,
		},
		{
			name:     "erreur interne, sans détail",
			catalog:  fakeCatalog{err: errors.New("connexion refusée")},
			wantCode: http.StatusInternalServerError,
			wantBody: `{"error": "internal"}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec := serve(tt.catalog, "/episodes/fr-001/audio")
			assertJSON(t, rec, tt.wantCode, tt.wantBody)
			if cc := rec.Header().Get("Cache-Control"); cc != "no-store" {
				t.Errorf("Cache-Control = %q, attendu no-store", cc)
			}
		})
	}
}
