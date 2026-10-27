import type { HistoryStore } from '../ports/historyStore.ts'

/** Les épisodes déjà entendus sur cet appareil : marques « écouté », progression des séries, tirage au hasard. */
export interface ListeningHistory {
  getSnapshot(): ReadonlySet<string>
  subscribe(listener: () => void): () => void
  markHeard(episodeId: string): void
  /** Ajoute les épisodes entendus sur un autre appareil du compte (synchronisation). */
  merge(episodeIds: string[]): void
}

export function createListeningHistory(store: HistoryStore): ListeningHistory {
  let heard: ReadonlySet<string> = new Set(store.load())
  const listeners = new Set<() => void>()

  // Un épisode entendu le reste : l'historique ne fait que grandir.
  function add(episodeIds: string[]) {
    const added = episodeIds.filter((id) => !heard.has(id))
    if (added.length === 0) return
    heard = new Set([...heard, ...added]) // un nouvel ensemble : React compare par référence
    store.save([...heard])
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => heard,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    markHeard(episodeId) {
      add([episodeId])
    },
    merge(episodeIds) {
      add(episodeIds)
    },
  }
}
