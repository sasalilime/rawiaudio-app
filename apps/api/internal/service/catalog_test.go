package service

import (
	"context"
	"errors"
	"slices"
	"testing"
	"time"
)

// fakeStore remplace la base : il renvoie ce qu'on lui donne.
type fakeStore struct {
	episodes []EpisodeSummary
	episode  Episode
	err      error
}

func (f fakeStore) Episodes(context.Context, string) ([]EpisodeSummary, error) {
	return f.episodes, f.err
}

func (f fakeStore) Episode(context.Context, string) (Episode, error) {
	return f.episode, f.err
}

var now = time.Date(2026, 10, 26, 12, 0, 0, 0, time.UTC)

func at(t time.Time) *time.Time { return &t }

func summary(id string, publishedAt *time.Time) EpisodeSummary {
	return EpisodeSummary{ID: id, PublishedAt: publishedAt}
}

func TestEpisodesKeepsOnlyPublished(t *testing.T) {
	store := fakeStore{episodes: []EpisodeSummary{
		summary("fr-004", at(now.Add(time.Hour))), // programmé
		summary("fr-003", at(now)),                // publié à l'instant même
		summary("fr-002", nil),                    // brouillon
		summary("fr-001", at(now.AddDate(0, 0, -10))),
	}}
	catalog := NewCatalog(store, func() time.Time { return now })

	got, err := catalog.Episodes(t.Context(), "fr")
	if err != nil {
		t.Fatal(err)
	}
	var ids []string
	for _, episode := range got {
		ids = append(ids, episode.ID)
	}
	if want := []string{"fr-003", "fr-001"}; !slices.Equal(ids, want) {
		t.Errorf("épisodes = %v, attendu %v (ordre du store conservé)", ids, want)
	}
}

func TestEpisodesNeverNil(t *testing.T) {
	catalog := NewCatalog(fakeStore{}, func() time.Time { return now })

	got, err := catalog.Episodes(t.Context(), "fr")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Error("liste nil : elle s'encoderait en null au lieu de []")
	}
}

func TestEpisodeHidesUnpublished(t *testing.T) {
	tests := []struct {
		name        string
		publishedAt *time.Time
		wantErr     error
	}{
		{name: "publié", publishedAt: at(now.AddDate(0, 0, -1)), wantErr: nil},
		{name: "programmé", publishedAt: at(now.Add(time.Minute)), wantErr: ErrNotFound},
		{name: "brouillon", publishedAt: nil, wantErr: ErrNotFound},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			store := fakeStore{episode: Episode{EpisodeSummary: summary("fr-001", tt.publishedAt)}}
			catalog := NewCatalog(store, func() time.Time { return now })

			got, err := catalog.Episode(t.Context(), "fr-001")
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("erreur = %v, attendu %v", err, tt.wantErr)
			}
			if err == nil && got.ID != "fr-001" {
				t.Errorf("id = %q, attendu fr-001", got.ID)
			}
		})
	}
}

func TestStoreErrorsAreWrapped(t *testing.T) {
	storeErr := errors.New("base injoignable")
	catalog := NewCatalog(fakeStore{err: storeErr}, func() time.Time { return now })

	if _, err := catalog.Episodes(t.Context(), "fr"); !errors.Is(err, storeErr) {
		t.Errorf("Episodes : erreur = %v, attendu l'erreur du store", err)
	}
	if _, err := catalog.Episode(t.Context(), "fr-001"); !errors.Is(err, storeErr) {
		t.Errorf("Episode : erreur = %v, attendu l'erreur du store", err)
	}
	// ErrNotFound renvoyé par le store doit rester reconnaissable après l'enveloppe du service.
	notFound := NewCatalog(fakeStore{err: ErrNotFound}, func() time.Time { return now })
	if _, err := notFound.Episode(t.Context(), "fr-999"); !errors.Is(err, ErrNotFound) {
		t.Errorf("erreur = %v, attendu ErrNotFound", err)
	}
}
