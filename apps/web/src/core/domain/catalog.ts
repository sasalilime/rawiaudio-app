import type { EpisodeSummary, ThemeRef } from './episode.ts'

export interface ThemeSection {
  /** null : les épisodes sans thème (« Autres histoires »), toujours en dernier. */
  theme: ThemeRef | null
  /** Du plus récent au plus ancien. */
  episodes: EpisodeSummary[]
}

/** Le catalogue tel qu'on le présente aux familles. */
export interface Catalog {
  /** Le dernier épisode sorti, mis en avant ; null si le catalogue est vide. */
  latest: EpisodeSummary | null
  /** Une section par thème, dans l'ordre des thèmes. */
  sections: ThemeSection[]
}

/**
 * Range les épisodes par thème. Un épisode de plusieurs thèmes figure dans chacun.
 * episodes doit être trié du plus récent au plus ancien, comme l'API les renvoie.
 */
export function arrangeCatalog(episodes: EpisodeSummary[]): Catalog {
  const byTheme = new Map<string, ThemeSection>()
  const withoutTheme: EpisodeSummary[] = []

  for (const episode of episodes) {
    if (episode.themes.length === 0) withoutTheme.push(episode)
    for (const theme of episode.themes) {
      let section = byTheme.get(theme.id)
      if (!section) {
        section = { theme, episodes: [] }
        byTheme.set(theme.id, section)
      }
      section.episodes.push(episode)
    }
  }

  const sections = [...byTheme.values()].sort((a, b) => (a.theme?.position ?? 0) - (b.theme?.position ?? 0))
  if (withoutTheme.length > 0) sections.push({ theme: null, episodes: withoutTheme })
  return { latest: episodes[0] ?? null, sections }
}
