import type { HistoryStore } from '../ports/historyStore.ts'

/** Les épisodes déjà entendus sur cet appareil : marques « écouté », progression des séries, tirage au hasard. */
export interface ListeningHistory {
  getSnapshot(): ReadonlySet<string>
  subscribe(listener: () => void): () => void
  markHeard(episodeId: string): void
}

export function createListeningHistory(store: HistoryStore): ListeningHistory {
  let heard: ReadonlySet<string> = new Set(store.load())
  const listeners = new Set<() => void>()

  return {
    getSnapshot: () => heard,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    markHeard(episodeId) {
      if (heard.has(episodeId)) return
      heard = new Set([...heard, episodeId]) // un nouvel ensemble : React compare par référence
      store.save([...heard])
      for (const listener of listeners) listener()
    },
  }
}
