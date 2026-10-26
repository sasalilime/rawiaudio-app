import type { Episode, EpisodeSummary, Lang } from '../../core/domain/episode.ts'
import { NotFoundError, UnavailableError } from '../../core/domain/errors.ts'
import type { AudioUrl } from '../../core/domain/playback.ts'
import type { EpisodeRepository } from '../../core/ports/episodeRepository.ts'
import { ApiError, type Api } from './apiClient.ts'
import type * as dto from './types.ts'

/** Implémente EpisodeRepository avec l'API Rawi. */
export function createHttpEpisodeRepository(api: Api): EpisodeRepository {
  return {
    async list(lang: Lang, signal?: AbortSignal) {
      const { episodes } = await translateErrors(api.listEpisodes(lang, signal), signal)
      return episodes.map(toSummary)
    },
    async get(id: string, signal?: AbortSignal) {
      return toEpisode(await translateErrors(api.getEpisode(id, signal), signal))
    },
    async getAudioUrl(id: string, signal?: AbortSignal): Promise<AudioUrl> {
      const audio = await translateErrors(api.getAudioUrl(id, signal), signal)
      return { url: audio.url, expiresAt: new Date(audio.expiresAt) }
    },
  }
}

// Le cœur ne connaît pas ApiError : on la traduit dans les erreurs qu'il définit.
async function translateErrors<T>(request: Promise<T>, signal?: AbortSignal): Promise<T> {
  try {
    return await request
  } catch (error) {
    if (signal?.aborted) throw error // annulation voulue : rien à traduire
    if (error instanceof ApiError && error.status === 404) {
      throw new NotFoundError('introuvable ou pas encore publié', { cause: error })
    }
    throw new UnavailableError('API injoignable', { cause: error })
  }
}

function toSummary(episode: dto.EpisodeSummary): EpisodeSummary {
  return {
    id: episode.id,
    number: episode.number,
    slug: episode.slug,
    title: episode.title,
    reference: episode.reference,
    durationSeconds: episode.durationSeconds,
    publishedAt: new Date(episode.publishedAt),
    series: episode.series && { id: episode.series.id, title: episode.series.title, part: episode.series.part },
    themes: episode.themes.map((theme) => ({ id: theme.id, title: theme.title, position: theme.position })),
  }
}

function toEpisode(episode: dto.Episode): Episode {
  return {
    ...toSummary(episode),
    summary: [...episode.summary],
    sources: episode.sources.map((source) => ({ label: source.label, url: source.url })),
  }
}
