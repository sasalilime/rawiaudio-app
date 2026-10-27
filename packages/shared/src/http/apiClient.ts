import type { Account, AudioUrl, Client, Episode, EpisodeList, HeardEpisodes, Lang, SessionOpened } from './types.ts'

/** Échec d'un appel : status 0 quand la requête n'a pas pu partir (hors ligne, serveur injoignable). */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  /** Secondes à attendre, d'après Retry-After (réponse 429) ; null sinon. */
  readonly retryAfterSeconds: number | null

  constructor(status: number, code: string, options?: ErrorOptions & { retryAfterSeconds?: number | null }) {
    super(`API ${status} ${code}`, options)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = options?.retryAfterSeconds ?? null
  }
}

export type Api = ReturnType<typeof createApi>

/** Comment la session accompagne chaque appel (ADR-0012). */
export interface ApiOptions {
  /** PWA : 'include', pour que le navigateur envoie le cookie de session à api.rawiaudio.com. */
  credentials?: RequestCredentials
  /** App mobile : le jeton de session, lu à chaque appel, envoyé dans Authorization. */
  token?: () => Promise<string | null>
}

/** baseUrl : /api en dev (relais de Vite), https://api.rawiaudio.com en production. */
export function createApi(baseUrl: string, fetchFn: typeof fetch = fetch, options: ApiOptions = {}) {
  // ponytail: les réponses ne sont pas validées à l'exécution, on fait confiance au contrat.
  async function call(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<Response> {
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const token = await options.token?.()
    if (token) headers.Authorization = `Bearer ${token}`
    let response: Response
    try {
      response = await fetchFn(baseUrl + path, {
        method,
        signal,
        headers,
        credentials: options.credentials,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch (cause) {
      if (signal?.aborted) throw cause // annulation voulue (page quittée) : pas une erreur réseau
      throw new ApiError(0, 'network', { cause })
    }
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('Retry-After'))
      throw new ApiError(response.status, await errorCode(response), {
        retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null,
      })
    }
    return response
  }

  async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const body: unknown = await (await call('GET', path, undefined, signal)).json()
    return body as T
  }

  async function postJson<T>(path: string, body: unknown): Promise<T> {
    const answer: unknown = await (await call('POST', path, body)).json()
    return answer as T
  }

  return {
    listEpisodes: (lang: Lang, signal?: AbortSignal) =>
      getJson<EpisodeList>(`/episodes?lang=${lang}`, signal),
    getEpisode: (id: string, signal?: AbortSignal) =>
      getJson<Episode>(`/episodes/${encodeURIComponent(id)}`, signal),
    getAudioUrl: (id: string, signal?: AbortSignal) =>
      getJson<AudioUrl>(`/episodes/${encodeURIComponent(id)}/audio`, signal),

    // Connexion (ADR-0012). Les réponses 202 et 204 n'ont pas de corps : rien à lire.
    requestLogin: async (email: string) => {
      await call('POST', '/auth/login', { email })
    },
    verifyCode: (email: string, code: string, client: Client) =>
      postJson<SessionOpened>('/auth/code', { email, code, client }),
    verifyLink: (token: string, client: Client) => postJson<SessionOpened>('/auth/link', { token, client }),
    logout: async () => {
      await call('POST', '/auth/logout')
    },
    getAccount: () => getJson<Account>('/account'),
    deleteAccount: async () => {
      await call('DELETE', '/account')
    },
    syncHistory: (episodeIds: string[]) => postJson<HeardEpisodes>('/account/history', { episodeIds }),
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
