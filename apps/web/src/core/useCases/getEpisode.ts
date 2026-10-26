import type { Episode } from '../domain/episode.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'

/** La fiche d'un épisode publié ; NotFoundError s'il n'existe pas ou n'est pas encore publié. */
export type GetEpisode = (id: string, signal?: AbortSignal) => Promise<Episode>

// ponytail: simple relais pour l'instant ; l'état « téléchargé » viendra ici.
export function createGetEpisode(episodes: EpisodeRepository): GetEpisode {
  return (id, signal) => episodes.get(id, signal)
}
