import type { EpisodeSummary, Lang } from '../../core/domain/episode.ts'
import { useUseCases } from '../useCases.tsx'
import { useAsync, type AsyncState } from './useAsync.ts'

/** Les épisodes publiés d'une langue, rechargés si la langue change. */
export function useCatalog(lang: Lang): [AsyncState<EpisodeSummary[]>, () => void] {
  const { listCatalog } = useUseCases()
  return useAsync(lang, (signal) => listCatalog(lang, signal))
}
