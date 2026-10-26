import type { HistoryStore } from '../../core/ports/historyStore.ts'

const KEY = 'rawi:heard'

/** Les épisodes entendus, dans localStorage. Stockage refusé ou illisible : historique vide, jamais d'erreur. */
export function createLocalHistoryStore(storage: Storage): HistoryStore {
  return {
    load() {
      try {
        const value: unknown = JSON.parse(storage.getItem(KEY) ?? '[]')
        return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
      } catch {
        return []
      }
    },
    save(episodeIds) {
      try {
        storage.setItem(KEY, JSON.stringify(episodeIds))
      } catch {
        // stockage refusé : l'historique ne survivra pas à la fermeture de l'appli
      }
    },
  }
}
