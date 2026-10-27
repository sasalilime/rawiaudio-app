import { useSyncExternalStore } from 'react'
import { useUseCases } from '../useCases.tsx'

/** Les épisodes déjà entendus sur cet appareil, re-rendus à chaque nouvel épisode entendu. */
export function useHistory(): ReadonlySet<string> {
  const { history } = useUseCases()
  return useSyncExternalStore(history.subscribe, history.getSnapshot)
}
