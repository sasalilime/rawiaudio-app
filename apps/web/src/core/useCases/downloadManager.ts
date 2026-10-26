import type { EpisodeSummary } from '../domain/episode.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'
import type { OfflineAudioStore } from '../ports/offlineAudioStore.ts'

export type DownloadState =
  | { status: 'downloading'; progress: number | null }
  | { status: 'downloaded' }
  | { status: 'error' }

/** État des téléchargements par identifiant d'épisode ; absent = pas téléchargé. */
export type DownloadsSnapshot = ReadonlyMap<string, DownloadState>

export interface DownloadManager {
  getSnapshot(): DownloadsSnapshot
  subscribe(listener: () => void): () => void
  /** Relit la liste des épisodes déjà enregistrés sur l'appareil (au démarrage). */
  load(): Promise<void>
  download(episode: EpisodeSummary): Promise<void>
  remove(episodeId: string): Promise<void>
  /** Adresse de la copie locale, ou null. Synchrone : la lecture ne doit rien attendre. */
  localSource(episodeId: string): string | null
}

export function createDownloadManager(episodes: EpisodeRepository, store: OfflineAudioStore): DownloadManager {
  let snapshot: DownloadsSnapshot = new Map()
  const listeners = new Set<() => void>()

  // Une nouvelle Map à chaque changement : React compare les instantanés par référence.
  function set(episodeId: string, state: DownloadState | null) {
    const next = new Map(snapshot)
    if (state) next.set(episodeId, state)
    else next.delete(episodeId)
    snapshot = next
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async load() {
      const ids = await store.list()
      snapshot = new Map([...snapshot, ...ids.map((id): [string, DownloadState] => [id, { status: 'downloaded' }])])
      for (const listener of listeners) listener()
    },
    async download(episode) {
      if (snapshot.get(episode.id)?.status === 'downloading') return
      set(episode.id, { status: 'downloading', progress: null })
      try {
        const audio = await episodes.getAudioUrl(episode.id)
        await store.save(episode.id, audio.url, (progress) => set(episode.id, { status: 'downloading', progress }))
        set(episode.id, { status: 'downloaded' })
      } catch {
        set(episode.id, { status: 'error' }) // l'interface propose de réessayer
        return
      }
      // Après le premier téléchargement : demander que le navigateur ne les efface pas. Un refus ne change rien d'autre.
      await store.persist().catch(() => false)
    },
    async remove(episodeId) {
      await store.remove(episodeId)
      set(episodeId, null)
    },
    localSource(episodeId) {
      return snapshot.get(episodeId)?.status === 'downloaded' ? store.localUrl(episodeId) : null
    },
  }
}
