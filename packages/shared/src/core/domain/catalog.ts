import type { EpisodeSummary, ThemeRef } from './episode.ts'

/** Une série (une histoire en plusieurs parties) telle que l'accueil la présente. */
export interface SeriesOverview {
  id: string
  title: string
  /** Les parties publiées, par numéro croissant. */
  parts: EpisodeSummary[]
  durationSeconds: number
}

/** Une entrée de l'accueil : un épisode indépendant, ou une série entière. */
export type CatalogItem = { kind: 'episode'; episode: EpisodeSummary } | { kind: 'series'; series: SeriesOverview }

export interface ThemeSection {
  /** null : les entrées sans thème (« Autres histoires »), toujours en dernier. */
  theme: ThemeRef | null
  /** De la plus récente à la plus ancienne ; une série prend la place de sa dernière partie publiée. */
  items: CatalogItem[]
}

/** Le catalogue tel qu'on le présente aux familles. */
export interface Catalog {
  /** Tous les épisodes publiés, du plus récent au plus ancien. */
  episodes: EpisodeSummary[]
  /** Le dernier épisode sorti, mis en avant ; null si le catalogue est vide. */
  latest: EpisodeSummary | null
  /** Une section par thème, dans l'ordre des thèmes. */
  sections: ThemeSection[]
}

/**
 * Range le catalogue : chaque série devient une seule entrée, rangée dans les thèmes de ses parties.
 * episodes doit être trié du plus récent au plus ancien, comme l'API les renvoie.
 */
export function arrangeCatalog(episodes: EpisodeSummary[]): Catalog {
  const series = groupSeries(episodes)
  const byTheme = new Map<string, ThemeSection>()
  const withoutTheme: CatalogItem[] = []
  const placedSeries = new Set<string>()

  for (const episode of episodes) {
    let item: CatalogItem
    let themes: ThemeRef[]
    if (episode.series) {
      if (placedSeries.has(episode.series.id)) continue
      placedSeries.add(episode.series.id)
      const overview = series.get(episode.series.id)
      if (!overview) continue
      item = { kind: 'series', series: overview }
      themes = themesOf(overview.parts)
    } else {
      item = { kind: 'episode', episode }
      themes = episode.themes
    }

    if (themes.length === 0) withoutTheme.push(item)
    for (const theme of themes) {
      let section = byTheme.get(theme.id)
      if (!section) {
        section = { theme, items: [] }
        byTheme.set(theme.id, section)
      }
      section.items.push(item)
    }
  }

  const sections = [...byTheme.values()].sort((a, b) => (a.theme?.position ?? 0) - (b.theme?.position ?? 0))
  if (withoutTheme.length > 0) sections.push({ theme: null, items: withoutTheme })
  return { episodes, latest: episodes[0] ?? null, sections }
}

/** La série seriesId, ou null si aucune de ses parties n'est publiée. */
export function findSeries(episodes: EpisodeSummary[], seriesId: string): SeriesOverview | null {
  return groupSeries(episodes).get(seriesId) ?? null
}

/** La partie publiée qui suit episode dans sa série, ou null (épisode indépendant, ou dernière partie). */
export function nextPart(episodes: EpisodeSummary[], episode: EpisodeSummary): EpisodeSummary | null {
  if (!episode.series) return null
  const parts = findSeries(episodes, episode.series.id)?.parts ?? []
  const part = episode.series.part
  return parts.find((candidate) => (candidate.series?.part ?? 0) > part) ?? null
}

function groupSeries(episodes: EpisodeSummary[]): Map<string, SeriesOverview> {
  const series = new Map<string, SeriesOverview>()
  for (const episode of episodes) {
    if (!episode.series) continue
    let overview = series.get(episode.series.id)
    if (!overview) {
      overview = { id: episode.series.id, title: episode.series.title, parts: [], durationSeconds: 0 }
      series.set(episode.series.id, overview)
    }
    overview.parts.push(episode)
    overview.durationSeconds += episode.durationSeconds
  }
  for (const overview of series.values()) {
    overview.parts.sort((a, b) => (a.series?.part ?? 0) - (b.series?.part ?? 0))
  }
  return series
}

// Les thèmes d'une série : ceux de toutes ses parties, sans doublon, dans l'ordre des thèmes.
function themesOf(parts: EpisodeSummary[]): ThemeRef[] {
  const themes = new Map(parts.flatMap((part) => part.themes).map((theme): [string, ThemeRef] => [theme.id, theme]))
  return [...themes.values()].sort((a, b) => a.position - b.position)
}
