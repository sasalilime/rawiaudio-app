import type { Episode } from '../domain/episode.ts'
import { UnavailableError } from '../domain/errors.ts'
import type { CatalogCache } from '../ports/catalogCache.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'

/** La fiche d'un épisode publié ; NotFoundError s'il n'existe pas ou n'est pas encore publié. */
export type GetEpisode = (id: string, signal?: AbortSignal) => Promise<Episode>

/** Sans réseau, la dernière fiche connue de cet épisode. */
export function createGetEpisode(episodes: EpisodeRepository, cache: CatalogCache): GetEpisode {
  return async (id, signal) => {
    try {
      const episode = await episodes.get(id, signal)
      cache.saveEpisode(episode)
      return episode
    } catch (error) {
      const cached = error instanceof UnavailableError ? cache.getEpisode(id) : null
      if (cached) return cached
      throw error
    }
  }
}
