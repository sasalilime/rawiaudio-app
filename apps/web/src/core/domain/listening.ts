import { findSeries } from './catalog.ts'
import type { EpisodeSummary } from './episode.ts'

/**
 * Part de la durée au-delà de laquelle un épisode compte comme entendu (ADR-0007).
 * Ne touche pas à la reprise : la position d'écoute est gardée à part.
 */
export const HEARD_THRESHOLD = 0.95

export function isHeard(position: number, durationSeconds: number): boolean {
  return durationSeconds > 0 && position >= durationSeconds * HEARD_THRESHOLD
}

/**
 * Une histoire au hasard : d'abord parmi celles pas encore entendues (un épisode indépendant, ou la prochaine
 * partie non entendue d'une série) ; si tout a été entendu, dans tout le catalogue, une série par sa partie 1.
 * isAvailable écarte ce qui ne peut pas être lu maintenant (hors ligne : ce qui n'est pas téléchargé).
 * random renvoie un nombre dans [0, 1), comme Math.random.
 */
export function pickRandomEpisode(
  episodes: EpisodeSummary[],
  heard: ReadonlySet<string>,
  isAvailable: (episode: EpisodeSummary) => boolean,
  random: () => number,
): EpisodeSummary | null {
  const unheard: EpisodeSummary[] = []
  const starts: EpisodeSummary[] = []
  const seenSeries = new Set<string>()

  for (const episode of episodes) {
    if (!episode.series) {
      starts.push(episode)
      if (!heard.has(episode.id)) unheard.push(episode)
      continue
    }
    if (seenSeries.has(episode.series.id)) continue
    seenSeries.add(episode.series.id)
    const parts = findSeries(episodes, episode.series.id)?.parts ?? []
    if (parts[0]) starts.push(parts[0])
    // Jamais une partie 3 avant la partie 2 : seule la prochaine partie non entendue est candidate.
    const next = parts.find((part) => !heard.has(part.id))
    if (next) unheard.push(next)
  }

  const pool = unheard.filter(isAvailable)
  const candidates = pool.length > 0 ? pool : starts.filter(isAvailable)
  return candidates[Math.floor(random() * candidates.length)] ?? null
}
