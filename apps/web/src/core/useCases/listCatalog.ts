import type { EpisodeSummary, Lang } from '../domain/episode.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'

/** Les épisodes publiés d'une langue, du plus récent au plus ancien. */
export type ListCatalog = (lang: Lang, signal?: AbortSignal) => Promise<EpisodeSummary[]>

// ponytail: simple relais pour l'instant ; le rangement par série et l'état « téléchargé » viendront ici.
export function createListCatalog(episodes: EpisodeRepository): ListCatalog {
  return (lang, signal) => episodes.list(lang, signal)
}
