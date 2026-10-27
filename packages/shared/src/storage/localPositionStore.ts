import type { PositionStore } from '../core/ports/positionStore.ts'

const key = (episodeId: string) => `rawi:position:${episodeId}`

/**
 * Positions d'écoute dans localStorage. Le stockage peut être refusé (navigation privée, quota) :
 * on perd alors la reprise, jamais la lecture, d'où les erreurs volontairement sans suite.
 */
export function createLocalPositionStore(storage: Storage): PositionStore {
  return {
    get(episodeId) {
      try {
        const value = storage.getItem(key(episodeId))
        const seconds = value === null ? Number.NaN : Number(value)
        return Number.isFinite(seconds) ? seconds : null
      } catch {
        return null
      }
    },
    save(episodeId, seconds) {
      try {
        storage.setItem(key(episodeId), String(Math.floor(seconds)))
      } catch {
        // stockage refusé : la reprise ne marchera pas pour cet épisode
      }
    },
    clear(episodeId) {
      try {
        storage.removeItem(key(episodeId))
      } catch {
        // stockage refusé : rien à effacer
      }
    },
  }
}
