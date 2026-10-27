package service

import (
	"context"
	"fmt"
	"time"
)

// HistoryStore lit et écrit l'historique d'écoute. Implémenté par repository.History.
type HistoryStore interface {
	AddHeard(ctx context.Context, accountID int64, episodeIDs []string, now time.Time) error
	HeardEpisodes(ctx context.Context, accountID int64) ([]string, error)
}

// History synchronise l'historique d'écoute d'un compte entre ses appareils (ADR-0007).
type History struct {
	store HistoryStore
	now   func() time.Time
}

func NewHistory(store HistoryStore, now func() time.Time) *History {
	return &History{store: store, now: now}
}

// Sync ajoute les épisodes entendus sur un appareil, puis renvoie tout l'historique du compte : l'appareil
// garde l'union. Jamais nil : une liste vide s'encode en [], pas en null.
func (h *History) Sync(ctx context.Context, accountID int64, episodeIDs []string) ([]string, error) {
	if len(episodeIDs) > 0 {
		if err := h.store.AddHeard(ctx, accountID, episodeIDs, h.now()); err != nil {
			return nil, fmt.Errorf("synchronisation de l'historique: %w", err)
		}
	}
	heard, err := h.store.HeardEpisodes(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("synchronisation de l'historique: %w", err)
	}
	if heard == nil {
		heard = []string{}
	}
	return heard, nil
}
