import type { HistoryGateway } from '../core/ports/historyGateway.ts'
import type { Api } from './apiClient.ts'

/** Implémente HistoryGateway avec l'API Rawi. La session suit createApi : cookie (PWA) ou jeton (app). */
export function createHttpHistoryGateway(api: Api): HistoryGateway {
  return {
    async sync(episodeIds) {
      const { episodeIds: heard } = await api.syncHistory(episodeIds)
      return heard
    },
  }
}
