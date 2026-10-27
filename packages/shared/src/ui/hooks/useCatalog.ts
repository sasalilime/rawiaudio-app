import type { Catalog } from '../../core/domain/catalog.ts'
import type { Lang } from '../../core/domain/episode.ts'
import { useUseCases } from '../useCases.tsx'
import { useAsync, type AsyncState } from './useAsync.ts'

/** Le catalogue d'une langue, rangé par thème, rechargé si la langue change. */
export function useCatalog(lang: Lang): [AsyncState<Catalog>, () => void] {
  const { listCatalog } = useUseCases()
  return useAsync(lang, (signal) => listCatalog(lang, signal))
}
