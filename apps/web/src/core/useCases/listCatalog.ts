import type { EpisodeSummary, Lang } from '../domain/episode.ts'
import { UnavailableError } from '../domain/errors.ts'
import type { CatalogCache } from '../ports/catalogCache.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'

/** Les épisodes publiés d'une langue, du plus récent au plus ancien. */
export type ListCatalog = (lang: Lang, signal?: AbortSignal) => Promise<EpisodeSummary[]>

/** Sans réseau, la dernière liste connue : les épisodes téléchargés restent accessibles. */
export function createListCatalog(episodes: EpisodeRepository, cache: CatalogCache): ListCatalog {
  return async (lang, signal) => {
    try {
      const list = await episodes.list(lang, signal)
      cache.saveList(lang, list)
      return list
    } catch (error) {
      const cached = error instanceof UnavailableError ? cache.getList(lang) : null
      if (cached) return cached
      throw error
    }
  }
}
