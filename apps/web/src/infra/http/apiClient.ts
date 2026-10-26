import type { AudioUrl, Episode, EpisodeList, Lang } from './types.ts'

/** Échec d'un appel : status 0 quand la requête n'a pas pu partir (hors ligne, serveur injoignable). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, options?: ErrorOptions) {
    super(`API ${status} ${code}`, options)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export type Api = ReturnType<typeof createApi>

/** baseUrl : /api en dev (relais de Vite), https://api.rawiaudio.com en production. */
export function createApi(baseUrl: string, fetchFn: typeof fetch = fetch) {
  // ponytail: les réponses ne sont pas validées à l'exécution, on fait confiance au contrat.
  async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    let response: Response
    try {
      response = await fetchFn(baseUrl + path, { signal, headers: { Accept: 'application/json' } })
    } catch (cause) {
      if (signal?.aborted) throw cause // annulation voulue (page quittée) : pas une erreur réseau
      throw new ApiError(0, 'network', { cause })
    }
    if (!response.ok) {
      throw new ApiError(response.status, await errorCode(response))
    }
    const body: unknown = await response.json()
    return body as T
  }

  return {
    listEpisodes: (lang: Lang, signal?: AbortSignal) =>
      getJson<EpisodeList>(`/episodes?lang=${lang}`, signal),
    getEpisode: (id: string, signal?: AbortSignal) =>
      getJson<Episode>(`/episodes/${encodeURIComponent(id)}`, signal),
    getAudioUrl: (id: string, signal?: AbortSignal) =>
      getJson<AudioUrl>(`/episodes/${encodeURIComponent(id)}/audio`, signal),
  }
}

// Le corps d'erreur de l'API est {"error": "<code>"} ; un proxy ou un serveur en panne peut renvoyer autre chose.
async function errorCode(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') {
      return body.error
    }
  } catch {
    // corps absent ou pas en JSON
  }
  return 'internal'
}
