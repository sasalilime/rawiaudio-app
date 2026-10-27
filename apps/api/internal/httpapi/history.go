package httpapi

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
)

// historyService est implémenté par service.History. En test, un faux le remplace.
type historyService interface {
	Sync(ctx context.Context, accountID int64, episodeIDs []string) ([]string, error)
}

// maxHeardEpisodes : bien au-delà du catalogue prévu, assez bas pour qu'une requête reste petite.
const maxHeardEpisodes = 2000

// maxHistoryBodyBytes : 2 000 identifiants de 9 caractères, guillemets et virgules compris, avec de la marge.
const maxHistoryBodyBytes = 32 << 10

type historyRequest struct {
	EpisodeIDs []string `json:"episodeIds"`
}

func (req historyRequest) Validate() error {
	if req.EpisodeIDs == nil {
		return errors.New("episodeIds obligatoire (liste vide acceptée)")
	}
	if len(req.EpisodeIDs) > maxHeardEpisodes {
		return errors.New("trop d'épisodes")
	}
	for _, id := range req.EpisodeIDs {
		if !episodeID.MatchString(id) {
			return errors.New("identifiant d'épisode mal formé")
		}
	}
	return nil
}

type historyResponse struct {
	EpisodeIDs []string `json:"episodeIds"`
}

// syncHistory ajoute à l'historique du compte de la session les épisodes entendus sur l'appareil, et renvoie
// tout son historique. Le compte vient de la session, jamais de la requête.
func syncHistory(history historyService) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req historyRequest
		if err := decodeJSON(w, r, &req, maxHistoryBodyBytes); err != nil || req.Validate() != nil {
			writeError(w, r, http.StatusBadRequest, "invalid_request")
			return
		}
		heard, err := history.Sync(r.Context(), sessionFrom(r.Context()).account.ID, req.EpisodeIDs)
		if err != nil {
			slog.ErrorContext(r.Context(), "synchronisation de l'historique", "err", err)
			writeError(w, r, http.StatusInternalServerError, "internal")
			return
		}
		writeJSON(w, r, http.StatusOK, historyResponse{EpisodeIDs: heard})
	}
}
