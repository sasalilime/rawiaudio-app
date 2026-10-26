// Package repository contient le SQL de l'API, et aucune règle métier.
package repository

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"rawiaudio.com/api/internal/service"
)

// Catalog lit le catalogue. Il renvoie les épisodes publiés ou non :
// la visibilité se décide dans service.Catalog.
type Catalog struct {
	pool *pgxpool.Pool
}

func NewCatalog(pool *pgxpool.Pool) *Catalog {
	return &Catalog{pool: pool}
}

// Colonnes communes à la liste et à la fiche, dans l'ordre attendu par scanSummary.
const summaryColumns = `e.id, e.number, e.slug, e.title, e.reference, e.duration_seconds, e.published_at, s.id, s.title`

func (c *Catalog) Episodes(ctx context.Context, lang string) ([]service.EpisodeSummary, error) {
	rows, err := c.pool.Query(ctx, `
		SELECT `+summaryColumns+`
		FROM episodes e
		LEFT JOIN series s ON s.id = e.series_id
		WHERE e.lang = $1
		ORDER BY e.published_at DESC NULLS LAST, e.number DESC`, lang)
	if err != nil {
		return nil, fmt.Errorf("lecture des épisodes: %w", err)
	}
	episodes, err := pgx.CollectRows(rows, func(row pgx.CollectableRow) (service.EpisodeSummary, error) {
		return scanSummary(row)
	})
	if err != nil {
		return nil, fmt.Errorf("lecture des épisodes: %w", err)
	}
	return episodes, nil
}

func (c *Catalog) Episode(ctx context.Context, id string) (service.Episode, error) {
	var episode service.Episode
	row := c.pool.QueryRow(ctx, `
		SELECT `+summaryColumns+`, e.summary
		FROM episodes e
		LEFT JOIN series s ON s.id = e.series_id
		WHERE e.id = $1`, id)
	summary, err := scanSummary(row, &episode.Summary)
	if errors.Is(err, pgx.ErrNoRows) {
		return service.Episode{}, service.ErrNotFound
	}
	if err != nil {
		return service.Episode{}, fmt.Errorf("lecture de l'épisode: %w", err)
	}
	episode.EpisodeSummary = summary

	rows, err := c.pool.Query(ctx,
		`SELECT label, url FROM episode_sources WHERE episode_id = $1 ORDER BY position`, id)
	if err != nil {
		return service.Episode{}, fmt.Errorf("lecture des sources: %w", err)
	}
	// RowToStructByPos remplit les champs de Source dans l'ordre des colonnes : label, puis url.
	episode.Sources, err = pgx.CollectRows(rows, pgx.RowToStructByPos[service.Source])
	if err != nil {
		return service.Episode{}, fmt.Errorf("lecture des sources: %w", err)
	}
	return episode, nil
}

// scanSummary lit les colonnes de summaryColumns, puis celles passées dans extra.
func scanSummary(row pgx.Row, extra ...any) (service.EpisodeSummary, error) {
	var episode service.EpisodeSummary
	var seriesID, seriesTitle *string // NULL quand l'épisode n'a pas de série (LEFT JOIN)
	dest := append([]any{
		&episode.ID, &episode.Number, &episode.Slug, &episode.Title, &episode.Reference,
		&episode.DurationSeconds, &episode.PublishedAt, &seriesID, &seriesTitle,
	}, extra...)
	if err := row.Scan(dest...); err != nil {
		return service.EpisodeSummary{}, err
	}
	if seriesID != nil && seriesTitle != nil {
		episode.Series = &service.SeriesRef{ID: *seriesID, Title: *seriesTitle}
	}
	return episode, nil
}
