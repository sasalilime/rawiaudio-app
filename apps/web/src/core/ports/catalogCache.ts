import type { Episode, EpisodeSummary, Lang } from '../domain/episode.ts'

/** Dernières réponses connues du catalogue, pour ouvrir l'appli sans réseau. Implémenté dans infra/storage. */
export interface CatalogCache {
  /** null si rien n'est gardé, ou si le stockage est indisponible. */
  getList(lang: Lang): EpisodeSummary[] | null
  saveList(lang: Lang, episodes: EpisodeSummary[]): void
  getEpisode(id: string): Episode | null
  saveEpisode(episode: Episode): void
}
