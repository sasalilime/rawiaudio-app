import { useEffect, useMemo, useState } from 'react'
import type { EpisodeSummary } from '../../core/domain/episode.ts'
import { fr } from '../i18n/fr.ts'
import { useDownloads } from '../hooks/useDownloads.ts'
import { useHistory } from '../hooks/useHistory.ts'
import { useOnline } from '../hooks/useOnline.ts'
import { usePlayback } from '../hooks/usePlayback.ts'
import { useUseCases } from '../useCases.tsx'

/**
 * « Une histoire au hasard » (ADR-0007). Le tirage est fait à l'avance et son URL préparée :
 * le clic lance le son sans rien attendre, comme l'exige iOS.
 */
export function RandomButton({ episodes }: { episodes: EpisodeSummary[] }) {
  const { pickRandom } = useUseCases()
  const heard = useHistory()
  const [downloads] = useDownloads()
  const [, playback] = usePlayback()
  const online = useOnline()

  // Hors ligne, seuls les épisodes téléchargés comptent. La clé ne change que quand cette liste change,
  // pas à chaque pourcentage d'un téléchargement en cours.
  const downloaded = [...downloads].filter(([, state]) => state.status === 'downloaded').map(([id]) => id)
  const offlineKey = online ? '' : downloaded.join(',')
  const isAvailable = (episode: EpisodeSummary) => online || downloaded.includes(episode.id)

  // Un nouveau tirage seulement quand le catalogue, l'historique ou la connexion changent, ou après un clic.
  const [justPlayed, setJustPlayed] = useState<string | null>(null)
  const pick = useMemo(
    () => pickRandom(episodes, justPlayed ? new Set([...heard, justPlayed]) : heard, isAvailable),
    [episodes, heard, online, offlineKey, justPlayed, pickRandom], // isAvailable ne dépend que de online et offlineKey
  )
  useEffect(() => {
    if (pick) playback.prepare(pick)
  }, [pick, playback])

  if (!pick) return <p className="notice">{fr.randomUnavailable}</p>

  return (
    <button
      type="button"
      className="random-button"
      onClick={() => {
        playback.play(pick) // directement dans le clic : aucune attente avant
        setJustPlayed(pick.id) // le prochain tirage l'écarte, même s'il n'est pas encore entendu
      }}
    >
      {fr.random}
    </button>
  )
}
