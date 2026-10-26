import type { Episode, EpisodeSummary } from '../../core/domain/episode.ts'
import type { CatalogCache } from '../../core/ports/catalogCache.ts'

const listKey = (lang: string) => `rawi:catalog:${lang}`
const episodeKey = (id: string) => `rawi:episode:${id}`

/**
 * Dernières réponses du catalogue dans localStorage (quelques Ko).
 * Stockage refusé ou contenu illisible : on fait comme si rien n'était gardé.
 */
export function createLocalCatalogCache(storage: Storage): CatalogCache {
  function read<T extends EpisodeSummary>(key: string): T | null {
    try {
      const raw = storage.getItem(key)
      return raw === null ? null : reviveDate(JSON.parse(raw) as T)
    } catch {
      return null
    }
  }
  function write(key: string, value: unknown) {
    try {
      storage.setItem(key, JSON.stringify(value))
    } catch {
      // stockage refusé ou plein : seul l'accès sans réseau est perdu
    }
  }

  return {
    getList(lang) {
      try {
        const raw = storage.getItem(listKey(lang))
        return raw === null ? null : (JSON.parse(raw) as EpisodeSummary[]).map(reviveDate)
      } catch {
        return null
      }
    },
    saveList: (lang, episodes) => write(listKey(lang), episodes),
    getEpisode: (id) => read<Episode>(episodeKey(id)),
    saveEpisode: (episode) => write(episodeKey(episode.id), episode),
  }
}

// JSON ne connaît pas les dates : publishedAt revient en texte ISO.
// Un catalogue gardé avant l'arrivée des thèmes n'a pas de champ themes : on le complète.
function reviveDate<T extends EpisodeSummary>(episode: T): T {
  return { ...episode, publishedAt: new Date(episode.publishedAt), themes: episode.themes ?? [] }
}
