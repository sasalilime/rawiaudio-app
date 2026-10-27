import type { Episode } from '../../core/domain/episode.ts'
import { useUseCases } from '../useCases.tsx'
import { useAsync, type AsyncState } from './useAsync.ts'

/** La fiche d'un épisode ; l'erreur vaut NotFoundError s'il n'existe pas ou n'est pas encore publié. */
export function useEpisode(id: string): [AsyncState<Episode>, () => void] {
  const { getEpisode } = useUseCases()
  return useAsync(id, (signal) => getEpisode(id, signal))
}
