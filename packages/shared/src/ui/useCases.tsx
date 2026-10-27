import { createContext, useContext, type ReactNode } from 'react'
import type { DownloadManager } from '../core/useCases/downloadManager.ts'
import type { GetEpisode } from '../core/useCases/getEpisode.ts'
import type { ListCatalog } from '../core/useCases/listCatalog.ts'
import type { ListeningHistory } from '../core/useCases/listeningHistory.ts'
import type { PickRandomEpisode } from '../core/useCases/pickRandomEpisode.ts'
import type { PlaybackSession } from '../core/useCases/playbackSession.ts'

/** Les cas d'usage dont l'interface a besoin, assemblés dans main.tsx. */
export interface UseCases {
  listCatalog: ListCatalog
  getEpisode: GetEpisode
  playback: PlaybackSession
  downloads: DownloadManager
  history: ListeningHistory
  pickRandom: PickRandomEpisode
}

const UseCasesContext = createContext<UseCases | null>(null)

export function UseCasesProvider({ value, children }: { value: UseCases; children: ReactNode }) {
  return <UseCasesContext value={value}>{children}</UseCasesContext>
}

export function useUseCases(): UseCases {
  const useCases = useContext(UseCasesContext)
  if (!useCases) throw new Error('UseCasesProvider absent : voir main.tsx')
  return useCases
}
