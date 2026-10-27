import type { EpisodeSummary } from '@rawiaudio/shared/core/domain/episode.ts'
import { fr } from '@rawiaudio/shared/ui/i18n/fr.ts'
import { useRandomPick } from '@rawiaudio/shared/ui/hooks/useRandomPick.ts'
import { useOnline } from '../hooks/useOnline.ts'

/** « Une histoire au hasard » (ADR-0007), tirée d'avance : le clic lance le son sans attente. */
export function RandomButton({ episodes }: { episodes: EpisodeSummary[] }) {
  const [pick, play] = useRandomPick(episodes, useOnline())

  if (!pick) return <p className="notice">{fr.randomUnavailable}</p>

  return (
    <button type="button" className="random-button" onClick={play}>
      {fr.random}
    </button>
  )
}
