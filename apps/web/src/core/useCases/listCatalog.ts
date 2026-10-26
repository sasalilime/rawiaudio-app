import { arrangeCatalog, type Catalog } from '../domain/catalog.ts'
import type { Lang } from '../domain/episode.ts'
import { UnavailableError } from '../domain/errors.ts'
import type { CatalogCache } from '../ports/catalogCache.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'

/** Le catalogue d'une langue, rangé par thème. */
export type ListCatalog = (lang: Lang, signal?: AbortSignal) => Promise<Catalog>

/** Sans réseau, la dernière liste connue : les épisodes téléchargés restent accessibles. */
export function createListCatalog(episodes: EpisodeRepository, cache: CatalogCache): ListCatalog {
  return async (lang, signal) => {
    try {
      const list = await episodes.list(lang, signal)
      cache.saveList(lang, list)
      return arrangeCatalog(list)
    } catch (error) {
      const cached = error instanceof UnavailableError ? cache.getList(lang) : null
      if (cached) return arrangeCatalog(cached)
      throw error
    }
  }
}
