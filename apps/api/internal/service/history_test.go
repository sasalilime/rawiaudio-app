package service_test

import (
	"slices"
	"testing"
	"time"

	"rawiaudio.com/api/internal/repository"
	"rawiaudio.com/api/internal/service"
)

// historyFixture : la fixture de connexion, trois épisodes publiés, un brouillon et un programmé.
func historyFixture(t *testing.T) (fixture, *service.History) {
	t.Helper()
	f := newFixture(t, 90)
	_, err := f.pool.Exec(t.Context(), `
		INSERT INTO episodes (id, lang, number, slug, title, reference, duration_seconds, published_at) VALUES
			('fr-001', 'fr', 1, 'un', 'Un', 'Réf', 300, '2026-10-01 00:00:00+00'),
			('fr-002', 'fr', 2, 'deux', 'Deux', 'Réf', 300, '2026-10-02 00:00:00+00'),
			('fr-003', 'fr', 3, 'trois', 'Trois', 'Réf', 300, '2026-10-03 00:00:00+00'),
			('fr-004', 'fr', 4, 'brouillon', 'Brouillon', 'Réf', 300, NULL),
			('fr-005', 'fr', 5, 'programme', 'Programmé', 'Réf', 300, '2099-01-01 00:00:00+00')`)
	if err != nil {
		t.Fatalf("épisodes de test: %v", err)
	}
	return f, service.NewHistory(repository.NewHistory(f.pool), f.clock.Now)
}

func TestHistorySyncMergesDevices(t *testing.T) {
	f, history := historyFixture(t)
	account, _ := f.login(t, "parent@example.com")

	// Le téléphone, puis la tablette : chacun repart avec l'union.
	phone, err := history.Sync(t.Context(), account.ID, []string{"fr-002", "fr-001"})
	if err != nil {
		t.Fatal(err)
	}
	tablet, err := history.Sync(t.Context(), account.ID, []string{"fr-003", "fr-001"})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(phone, []string{"fr-001", "fr-002"}) || !slices.Equal(tablet, []string{"fr-001", "fr-002", "fr-003"}) {
		t.Errorf("téléphone %v, tablette %v", phone, tablet)
	}
	// Une liste vide ne retire rien : elle lit l'historique.
	if got, err := history.Sync(t.Context(), account.ID, []string{}); err != nil || len(got) != 3 {
		t.Errorf("lecture seule : %v, %v", got, err)
	}
}

func TestHistoryIgnoresUnknownAndUnpublishedEpisodes(t *testing.T) {
	f, history := historyFixture(t)
	account, _ := f.login(t, "parent@example.com")
	got, err := history.Sync(t.Context(), account.ID, []string{"fr-001", "fr-004", "fr-005", "fr-999"})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(got, []string{"fr-001"}) {
		t.Errorf("historique %v : brouillon, programmé ou inconnu accepté", got)
	}
	// Le programmé, une fois publié, s'ajoute normalement.
	f.clock.Advance(100 * 365 * 24 * time.Hour)
	if got, err := history.Sync(t.Context(), account.ID, []string{"fr-005"}); err != nil || !slices.Contains(got, "fr-005") {
		t.Errorf("épisode publié depuis : %v, %v", got, err)
	}
}

// A ne lit ni n'écrit jamais l'historique de B ; supprimer un compte supprime son historique.
func TestHistoryStaysWithItsAccount(t *testing.T) {
	f, history := historyFixture(t)
	a, _ := f.login(t, "a@example.com")
	b, _ := f.login(t, "b@example.com")
	if _, err := history.Sync(t.Context(), a.ID, []string{"fr-001"}); err != nil {
		t.Fatal(err)
	}
	if got, err := history.Sync(t.Context(), b.ID, []string{"fr-002"}); err != nil || !slices.Equal(got, []string{"fr-002"}) {
		t.Errorf("historique de B : %v, %v", got, err)
	}

	if err := f.auth.DeleteAccount(t.Context(), a.ID); err != nil {
		t.Fatal(err)
	}
	var left int
	if err := f.pool.QueryRow(t.Context(), `SELECT count(*) FROM heard_episodes WHERE account_id = $1`, a.ID).Scan(&left); err != nil || left != 0 {
		t.Errorf("historique de A après suppression du compte : %d lignes (%v)", left, err)
	}
}
