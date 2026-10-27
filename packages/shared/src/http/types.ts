// Réponses de l'API (DTO), recopiées de contracts/openapi.yaml : toute modification commence par le contrat.
// Elles ne sortent pas de infra/http : episodeRepository.ts les traduit en entités de core/domain.

export type Lang = 'fr' | 'ar' | 'en'

export interface SeriesRef {
  id: string
  title: string
  part: number
}

export interface ThemeRef {
  id: string
  title: string
  position: number
}

export interface EpisodeSummary {
  /** Identifiant immuable : langue et numéro, ex. fr-001. Clé du téléchargement hors ligne. */
  id: string
  number: number
  slug: string
  title: string
  /** Référence coranique, affichée telle quelle. */
  reference: string
  durationSeconds: number
  /** Date ISO 8601 en UTC. */
  publishedAt: string
  series: SeriesRef | null
  themes: ThemeRef[]
  /** Illustration (ADR-0009), adresse publique qui ne change jamais ; null si l'épisode n'en a pas. */
  imageUrl: string | null
}

export interface Source {
  label: string
  /** Lien Shamela uniquement. */
  url: string
}

export interface Episode extends EpisodeSummary {
  summary: string[]
  sources: Source[]
}

export interface EpisodeList {
  episodes: EpisodeSummary[]
}

export interface AudioUrl {
  /** URL signée sur R2, différente à chaque appel : ne jamais s'en servir comme clé de cache. */
  url: string
  /** Date ISO 8601 en UTC, au-delà de laquelle R2 refuse l'URL. */
  expiresAt: string
}

export type ErrorCode = 'invalid_request' | 'not_found' | 'internal'
