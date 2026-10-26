package repository

import (
	"errors"
	"slices"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"rawiaudio.com/api/internal/migrate"
	"rawiaudio.com/api/internal/pgtest"
	"rawiaudio.com/api/internal/service"
	"rawiaudio.com/api/migrations"
)

// catalogFixture applique les vraies migrations dans un schéma jetable, puis insère :
// fr-001 publié avec série et deux sources, fr-002 brouillon sans série, fr-003 programmé, en-001 en anglais.
func catalogFixture(t *testing.T) *pgxpool.Pool {
	t.Helper()
	pool := pgtest.Pool(t)
	if err := migrate.Run(t.Context(), pool, migrations.FS); err != nil {
		t.Fatalf("migrations: %v", err)
	}
	_, err := pool.Exec(t.Context(), `
		INSERT INTO series (id, lang, title) VALUES ('fr-al-kahf', 'fr', 'Al-Kahf');
		INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, published_at, summary, series_id, series_part) VALUES
			('fr-001', 'fr', 1, 'un', 'Un', 'Réf 1', 392, '2026-10-16 00:00:00+00', '{"premier", "second"}', 'fr-al-kahf', 2),
			('fr-002', 'fr', 2, 'deux', 'Deux', 'Réf 2', 400, NULL, '{}', NULL, NULL),
			('fr-003', 'fr', 3, 'trois', 'Trois', 'Réf 3', 410, '2099-01-01 00:00:00+00', '{}', NULL, NULL),
			('en-001', 'en', 1, 'one', 'One', 'Ref 1', 380, '2026-10-16 00:00:00+00', '{}', NULL, NULL);
		-- Insérées à l'envers : l'ordre de lecture doit suivre position.
		INSERT INTO episode_sources (episode_id, position, label, url) VALUES
			('fr-001', 2, 'Deuxième', 'https://shamela.ws/book/42/2'),
			('fr-001', 1, 'Première', 'https://shamela.ws/book/42/1');
		-- Positions inversées par rapport à l'ordre d'insertion : la lecture doit suivre position.
		INSERT INTO themes (id, lang, slug, title, position) VALUES
			('fr-prophetes', 'fr', 'prophetes', 'Les prophètes', 2),
			('fr-histoires-du-coran', 'fr', 'histoires-du-coran', 'Histoires du Coran', 1),
			('en-prophets', 'en', 'prophets', 'Prophets', 1);
		INSERT INTO episode_themes (episode_id, theme_id, lang) VALUES
			('fr-001', 'fr-prophetes', 'fr'),
			('fr-001', 'fr-histoires-du-coran', 'fr'),
			('en-001', 'en-prophets', 'en');`)
	if err != nil {
		t.Fatalf("données de test: %v", err)
	}
	return pool
}

func TestEpisodesReturnsAllOfOneLanguage(t *testing.T) {
	catalog := NewCatalog(catalogFixture(t))

	got, err := catalog.Episodes(t.Context(), "fr")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, episode := range got {
		ids = append(ids, episode.ID)
	}
	// Plus récent d'abord, brouillon (sans date) en dernier ; pas d'en-001.
	if want := []string{"fr-003", "fr-001", "fr-002"}; !slices.Equal(ids, want) {
		t.Fatalf("épisodes = %v, attendu %v", ids, want)
	}

	first := got[1]
	wantDate := time.Date(2026, 10, 16, 0, 0, 0, 0, time.UTC)
	if first.PublishedAt == nil || !first.PublishedAt.Equal(wantDate) {
		t.Errorf("fr-001 : publishedAt = %v, attendu %v", first.PublishedAt, wantDate)
	}
	if first.Series == nil || *first.Series != (service.SeriesRef{ID: "fr-al-kahf", Title: "Al-Kahf", Part: 2}) {
		t.Errorf("fr-001 : série = %+v, attendu fr-al-kahf, partie 2", first.Series)
	}
	if first.Lang != "fr" || first.Number != 1 || first.Slug != "un" || first.DurationSeconds != 392 || first.Reference != "Réf 1" {
		t.Errorf("fr-001 : champs = %+v", first)
	}
	if draft := got[2]; draft.PublishedAt != nil || draft.Series != nil {
		t.Errorf("fr-002 : publishedAt = %v, série = %v, attendu nil et nil", draft.PublishedAt, draft.Series)
	}
}

func TestEpisodesUnknownLanguageIsEmptyNotNil(t *testing.T) {
	catalog := NewCatalog(catalogFixture(t))

	got, err := catalog.Episodes(t.Context(), "ar")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || len(got) != 0 {
		t.Errorf("épisodes = %#v, attendu une liste vide non nil", got)
	}
}

func TestEpisodeReadsSummaryAndOrderedSources(t *testing.T) {
	catalog := NewCatalog(catalogFixture(t))

	got, err := catalog.Episode(t.Context(), "fr-001")
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != "fr-001" || got.Series == nil {
		t.Errorf("fiche = %+v", got.EpisodeSummary)
	}
	if want := []string{"premier", "second"}; !slices.Equal(got.Summary, want) {
		t.Errorf("résumé = %v, attendu %v", got.Summary, want)
	}
	want := []service.Source{
		{Label: "Première", URL: "https://shamela.ws/book/42/1"},
		{Label: "Deuxième", URL: "https://shamela.ws/book/42/2"},
	}
	if !slices.Equal(got.Sources, want) {
		t.Errorf("sources = %v, attendu %v", got.Sources, want)
	}
}

func TestEpisodeWithoutSourcesOrSummaryHasEmptySlices(t *testing.T) {
	catalog := NewCatalog(catalogFixture(t))

	got, err := catalog.Episode(t.Context(), "fr-002")
	if err != nil {
		t.Fatal(err)
	}
	// Des slices nil s'encoderaient en null dans le JSON de la fiche.
	if got.Summary == nil || got.Sources == nil {
		t.Errorf("résumé = %#v, sources = %#v, attendu deux slices vides non nil", got.Summary, got.Sources)
	}
}

func TestEpisodeUnknownIsNotFound(t *testing.T) {
	catalog := NewCatalog(catalogFixture(t))

	if _, err := catalog.Episode(t.Context(), "fr-999"); !errors.Is(err, service.ErrNotFound) {
		t.Errorf("erreur = %v, attendu service.ErrNotFound", err)
	}
}

func TestThemesAreReadInDisplayOrder(t *testing.T) {
	catalog := NewCatalog(catalogFixture(t))
	want := []service.ThemeRef{
		{ID: "fr-histoires-du-coran", Title: "Histoires du Coran", Position: 1},
		{ID: "fr-prophetes", Title: "Les prophètes", Position: 2},
	}

	episode, err := catalog.Episode(t.Context(), "fr-001")
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(episode.Themes, want) {
		t.Errorf("fiche : thèmes = %v, attendu %v", episode.Themes, want)
	}

	list, err := catalog.Episodes(t.Context(), "fr")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range list {
		switch e.ID {
		case "fr-001":
			if !slices.Equal(e.Themes, want) {
				t.Errorf("liste : thèmes de fr-001 = %v, attendu %v", e.Themes, want)
			}
		default:
			if len(e.Themes) != 0 {
				t.Errorf("liste : %s ne devrait avoir aucun thème, obtenu %v", e.ID, e.Themes)
			}
		}
	}
}

func TestThemeAndEpisodeMustShareLanguage(t *testing.T) {
	pool := catalogFixture(t)

	for _, row := range []string{
		"('fr-002', 'en-prophets', 'fr')", // thème anglais déclaré français
		"('fr-002', 'en-prophets', 'en')", // épisode français déclaré anglais
	} {
		if _, err := pool.Exec(t.Context(), "INSERT INTO episode_themes (episode_id, theme_id, lang) VALUES "+row); err == nil {
			t.Errorf("%s : insertion acceptée, attendu un refus de la base", row)
		}
	}
}

func TestSeriesPartsAreConsistent(t *testing.T) {
	pool := catalogFixture(t)

	for name, statement := range map[string]string{
		"série sans partie":        "INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, series_id) VALUES ('fr-004', 'fr', 4, 'q', 'Q', 'R', 1, 'fr-al-kahf')",
		"partie sans série":        "INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, series_part) VALUES ('fr-004', 'fr', 4, 'q', 'Q', 'R', 1, 1)",
		"même partie deux fois":    "INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, series_id, series_part) VALUES ('fr-004', 'fr', 4, 'q', 'Q', 'R', 1, 'fr-al-kahf', 2)",
		"série d'une autre langue": "INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, series_id, series_part) VALUES ('en-002', 'en', 2, 'q', 'Q', 'R', 1, 'fr-al-kahf', 3)",
	} {
		if _, err := pool.Exec(t.Context(), statement); err == nil {
			t.Errorf("%s : insertion acceptée, attendu un refus de la base", name)
		}
	}
}
