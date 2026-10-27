import { useSyncExternalStore } from 'react'
import type { DownloadManager, DownloadsSnapshot } from '../../core/useCases/downloadManager.ts'
import { useUseCases } from '../useCases.tsx'

/** L'état des téléchargements, re-rendu à chaque changement, et le gestionnaire pour agir dessus. */
export function useDownloads(): [DownloadsSnapshot, DownloadManager] {
  const { downloads } = useUseCases()
  return [useSyncExternalStore(downloads.subscribe, downloads.getSnapshot), downloads]
}
