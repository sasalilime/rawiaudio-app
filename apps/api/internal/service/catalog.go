// Package service contient la logique métier de l'API. Il n'importe jamais net/http.
package service

import (
	"context"
	"errors"
	"fmt"
	"time"
)

// ErrNotFound : la ressource n'existe pas, ou n'est pas visible (épisode pas encore publié).
var ErrNotFound = errors.New("introuvable")

// SeriesRef identifie la série d'un épisode.
type SeriesRef struct {
	ID    string
	Title string
}

// ThemeRef est un thème du catalogue ; Position donne l'ordre d'affichage des thèmes.
type ThemeRef struct {
	ID       string
	Title    string
	Position int
}

// EpisodeSummary est un épisode tel qu'il apparaît dans la liste du catalogue.
type EpisodeSummary struct {
	ID              string
	Lang            string // sert à la clé du fichier audio ; absent du JSON, déjà dans l'id
	Number          int
	Slug            string
	Title           string
	Reference       string
	DurationSeconds int
	PublishedAt     *time.Time // nil : pas de date de publication (brouillon)
	Series          *SeriesRef // nil : épisode hors série
	Themes          []ThemeRef // dans l'ordre d'affichage des thèmes ; vide si l'épisode n'en a pas
}

// Source est un passage d'un livre de Shamela, cité sous l'épisode.
type Source struct {
	Label string
	URL   string
}

// Episode est la fiche complète d'un épisode.
type Episode struct {
	EpisodeSummary
	Summary []string
	Sources []Source
}

// EpisodeStore lit les épisodes en base, publiés ou non : la visibilité se décide ici, pas dans le SQL.
// Implémenté par repository.Catalog.
type EpisodeStore interface {
	// Episodes renvoie les épisodes d'une langue, du plus récent au plus ancien.
	Episodes(ctx context.Context, lang string) ([]EpisodeSummary, error)
	// Episode renvoie ErrNotFound si l'identifiant n'existe pas.
	Episode(ctx context.Context, id string) (Episode, error)
}

// AudioTTL : durée de validité d'une URL audio (ADR-0003).
const AudioTTL = time.Hour

// SignAudioFunc renvoie une URL de lecture du fichier key, valable ttl à partir de now.
// En production : la méthode PresignGet de r2.Signer.
type SignAudioFunc func(key string, now time.Time, ttl time.Duration) string

// AudioURL est une URL temporaire vers le fichier audio d'un épisode.
type AudioURL struct {
	URL       string
	ExpiresAt time.Time
}

// Catalog sert le catalogue en lecture : uniquement les épisodes publiés.
type Catalog struct {
	store     EpisodeStore
	signAudio SignAudioFunc
	now       func() time.Time // time.Now en production, une heure fixe dans les tests
}

func NewCatalog(store EpisodeStore, signAudio SignAudioFunc, now func() time.Time) *Catalog {
	return &Catalog{store: store, signAudio: signAudio, now: now}
}

// Episodes renvoie les épisodes publiés d'une langue, du plus récent au plus ancien.
func (c *Catalog) Episodes(ctx context.Context, lang string) ([]EpisodeSummary, error) {
	all, err := c.store.Episodes(ctx, lang)
	if err != nil {
		return nil, fmt.Errorf("liste des épisodes: %w", err)
	}
	now := c.now()
	published := []EpisodeSummary{} // jamais nil : une slice nil s'encode en null en JSON, pas en []
	for _, episode := range all {
		if isPublished(episode, now) {
			published = append(published, episode)
		}
	}
	return published, nil
}

// Episode renvoie ErrNotFound si l'épisode n'existe pas ou n'est pas encore publié :
// un épisode programmé ne doit pas se deviner.
func (c *Catalog) Episode(ctx context.Context, id string) (Episode, error) {
	episode, err := c.store.Episode(ctx, id)
	if err != nil {
		return Episode{}, fmt.Errorf("épisode %s: %w", id, err)
	}
	if !isPublished(episode.EpisodeSummary, c.now()) {
		return Episode{}, ErrNotFound
	}
	return episode, nil
}

// AudioURL renvoie une URL temporaire du fichier audio, ou ErrNotFound si l'épisode n'est pas publié.
// C'est ici que se vérifiera l'abonnement, le jour où il existera.
//
// ponytail: passe par Episode (2 requêtes, sources comprises) ; une requête dédiée si la charge le demande.
func (c *Catalog) AudioURL(ctx context.Context, id string) (AudioURL, error) {
	episode, err := c.Episode(ctx, id)
	if err != nil {
		return AudioURL{}, err
	}
	// La signature ne garde que les secondes : l'URL expire à la seconde pleine, pas une fraction plus tard.
	now := c.now().UTC().Truncate(time.Second)
	return AudioURL{
		URL:       c.signAudio(audioKey(episode.EpisodeSummary), now, AudioTTL),
		ExpiresAt: now.Add(AudioTTL),
	}, nil
}

// audioKey : emplacement du fichier dans le bucket, ex. fr/001-les-gens-de-la-caverne/audio-128.mp3 (ADR-0003).
func audioKey(episode EpisodeSummary) string {
	return fmt.Sprintf("%s/%03d-%s/audio-128.mp3", episode.Lang, episode.Number, episode.Slug)
}

// isPublished : un épisode devient visible à sa date de publication, jamais avant.
func isPublished(episode EpisodeSummary, now time.Time) bool {
	return episode.PublishedAt != nil && !episode.PublishedAt.After(now)
}
