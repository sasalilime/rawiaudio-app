import { useEffect, useMemo, useState } from 'react'
import type { EpisodeSummary } from '../../core/domain/episode.ts'
import { useUseCases } from '../useCases.tsx'
import { useDownloads } from './useDownloads.ts'
import { useHistory } from './useHistory.ts'
import { usePlayback } from './usePlayback.ts'

/**
 * « Une histoire au hasard » (ADR-0007). Le tirage est fait à l'avance et son URL préparée :
 * le geste lance le son sans rien attendre, comme l'exige iOS.
 * Renvoie l'épisode tiré (null si aucun n'est écoutable) et la fonction à appeler dans le geste.
 */
export function useRandomPick(episodes: EpisodeSummary[], online: boolean): [EpisodeSummary | null, () => void] {
  const { pickRandom } = useUseCases()
  const heard = useHistory()
  const [downloads] = useDownloads()
  const [, playback] = usePlayback()

  // Hors ligne, seuls les épisodes téléchargés comptent. La clé ne change que quand cette liste change,
  // pas à chaque pourcentage d'un téléchargement en cours.
  const downloaded = [...downloads].filter(([, state]) => state.status === 'downloaded').map(([id]) => id)
  const offlineKey = online ? '' : downloaded.join(',')
  const isAvailable = (episode: EpisodeSummary) => online || downloaded.includes(episode.id)

  // Un nouveau tirage seulement quand le catalogue, l'historique ou la connexion changent, ou après un geste.
  const [justPlayed, setJustPlayed] = useState<string | null>(null)
  const pick = useMemo(
    () => pickRandom(episodes, justPlayed ? new Set([...heard, justPlayed]) : heard, isAvailable),
    [episodes, heard, online, offlineKey, justPlayed, pickRandom], // isAvailable ne dépend que de online et offlineKey
  )
  useEffect(() => {
    if (pick) playback.prepare(pick)
  }, [pick, playback])

  function play() {
    if (!pick) return
    playback.play(pick) // directement dans le geste : aucune attente avant
    setJustPlayed(pick.id) // le prochain tirage l'écarte, même s'il n'est pas encore entendu
  }

  return [pick, play]
}
