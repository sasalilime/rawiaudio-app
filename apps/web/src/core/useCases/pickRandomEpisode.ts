import type { EpisodeSummary } from '../domain/episode.ts'
import { pickRandomEpisode } from '../domain/listening.ts'

/** Une histoire au hasard, de préférence pas encore entendue (ADR-0007) ; null si rien n'est disponible. */
export type PickRandomEpisode = (
  episodes: EpisodeSummary[],
  heard: ReadonlySet<string>,
  isAvailable: (episode: EpisodeSummary) => boolean,
) => EpisodeSummary | null

/** random : Math.random en production, une suite fixe dans les tests. */
export function createPickRandomEpisode(random: () => number): PickRandomEpisode {
  return (episodes, heard, isAvailable) => pickRandomEpisode(episodes, heard, isAvailable, random)
}
