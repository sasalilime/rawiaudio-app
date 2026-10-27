import type { EpisodeSummary } from '../../core/domain/episode.ts'
import { useDownloads } from './useDownloads.ts'

export interface SeriesDownload {
  /** Parties déjà téléchargées. */
  done: number
  /** Un téléchargement de la série est en cours. */
  busy: boolean
  downloadAll(): Promise<void>
  removeAll(): void
}

/** Télécharger toutes les parties d'une série d'un coup, ou les supprimer. */
export function useSeriesDownload(parts: EpisodeSummary[]): SeriesDownload {
  const [downloads, manager] = useDownloads()

  return {
    done: parts.filter((part) => downloads.get(part.id)?.status === 'downloaded').length,
    busy: parts.some((part) => downloads.get(part.id)?.status === 'downloading'),
    async downloadAll() {
      // L'une après l'autre : sur un téléphone, plusieurs téléchargements en parallèle se gênent.
      for (const part of parts) {
        if (manager.getSnapshot().get(part.id)?.status !== 'downloaded') await manager.download(part)
      }
    },
    removeAll: () => parts.forEach((part) => void manager.remove(part.id)),
  }
}
