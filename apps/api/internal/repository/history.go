package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// History lit et écrit l'historique d'écoute des comptes.
type History struct {
	pool *pgxpool.Pool
}

func NewHistory(pool *pgxpool.Pool) *History {
	return &History{pool: pool}
}

// AddHeard ajoute les épisodes entendus. Un identifiant inconnu, ou celui d'un épisode pas encore publié,
// est ignoré sans erreur : il ne doit ni faire échouer la synchronisation, ni révéler qu'un brouillon existe.
// Un épisode déjà présent garde sa date (ON CONFLICT DO NOTHING).
func (h *History) AddHeard(ctx context.Context, accountID int64, episodeIDs []string, now time.Time) error {
	_, err := h.pool.Exec(ctx, `
		INSERT INTO heard_episodes (account_id, episode_id, heard_at)
		SELECT $1, e.id, $3
		FROM episodes e
		WHERE e.id = ANY($2) AND e.published_at <= $3
		ON CONFLICT DO NOTHING`, accountID, episodeIDs, now)
	if err != nil {
		return fmt.Errorf("ajout à l'historique: %w", err)
	}
	return nil
}

// HeardEpisodes renvoie les épisodes entendus par le compte, triés.
func (h *History) HeardEpisodes(ctx context.Context, accountID int64) ([]string, error) {
	rows, err := h.pool.Query(ctx,
		`SELECT episode_id FROM heard_episodes WHERE account_id = $1 ORDER BY episode_id`, accountID)
	if err != nil {
		return nil, fmt.Errorf("lecture de l'historique: %w", err)
	}
	ids, err := pgx.CollectRows(rows, pgx.RowTo[string])
	if err != nil {
		return nil, fmt.Errorf("lecture de l'historique: %w", err)
	}
	return ids, nil
}
