// Entités du catalogue. Indépendantes de l'API : infra/http traduit ses réponses vers ces types.

export type Lang = 'fr' | 'ar' | 'en'

/** La série (une histoire en plusieurs parties) d'un épisode, et sa place dans celle-ci. */
export interface SeriesRef {
  id: string
  title: string
  /** Numéro de la partie : 1, 2, 3… */
  part: number
}

export interface ThemeRef {
  id: string
  title: string
  /** Ordre d'affichage des thèmes dans le catalogue. */
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
  publishedAt: Date
  series: SeriesRef | null
  /** Dans l'ordre d'affichage des thèmes ; vide si l'épisode n'en a pas. */
  themes: ThemeRef[]
  /** Illustration 16:9 (ADR-0009), à une adresse qui ne change jamais ; null si l'épisode n'en a pas. */
  imageUrl: string | null
}

/** Un passage d'un livre de Shamela, cité sous l'épisode. */
export interface Source {
  label: string
  url: string
}

export interface Episode extends EpisodeSummary {
  /** Paragraphes recopiés de la fiche validée du studio. */
  summary: string[]
  sources: Source[]
}
