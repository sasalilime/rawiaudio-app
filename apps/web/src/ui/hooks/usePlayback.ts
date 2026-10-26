import { useSyncExternalStore } from 'react'
import type { PlaybackSession, PlaybackSnapshot } from '../../core/useCases/playbackSession.ts'
import { useUseCases } from '../useCases.tsx'

/** L'état de la lecture, re-rendu à chaque changement, et la session pour agir dessus. */
export function usePlayback(): [PlaybackSnapshot, PlaybackSession] {
  const { playback } = useUseCases()
  return [useSyncExternalStore(playback.subscribe, playback.getSnapshot), playback]
}
