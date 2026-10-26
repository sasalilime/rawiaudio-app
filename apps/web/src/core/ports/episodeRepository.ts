import type { Episode, EpisodeSummary, Lang } from '../domain/episode.ts'

/**
 * Accès aux épisodes publiés. Implémenté dans infra/http.
 * Lève NotFoundError pour un épisode inconnu ou pas encore publié, UnavailableError si le service est injoignable.
 * signal permet d'annuler la lecture quand la page est quittée.
 */
export interface EpisodeRepository {
  /** Du plus récent au plus ancien. */
  list(lang: Lang, signal?: AbortSignal): Promise<EpisodeSummary[]>
  get(id: string, signal?: AbortSignal): Promise<Episode>
}
