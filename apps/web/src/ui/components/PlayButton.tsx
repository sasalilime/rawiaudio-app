import { useEffect } from 'react'
import type { EpisodeSummary } from '../../core/domain/episode.ts'
import { formatClock } from '../format.ts'
import { fr } from '../i18n/fr.ts'
import { usePlayback } from '../hooks/usePlayback.ts'

/** Le bouton principal de la fiche : écouter, reprendre ou mettre en pause cet épisode. */
export function PlayButton({ episode }: { episode: EpisodeSummary }) {
  const [snapshot, playback] = usePlayback()
  const isCurrent = snapshot.episode?.id === episode.id
  const isRunning = isCurrent && (snapshot.status === 'playing' || snapshot.status === 'loading')

  // Dès l'ouverture de la fiche : l'URL sera prête, et le clic lancera le son sans attente (exigence d'iOS).
  useEffect(() => playback.prepare(episode), [playback, episode])

  const resumeAt = isCurrent ? snapshot.position : playback.resumeAt(episode)
  const label = isRunning ? fr.pause : resumeAt > 0 && snapshot.status !== 'ended' ? fr.resumeAt(formatClock(resumeAt)) : fr.play

  return (
    <button
      type="button"
      className="play-button"
      // Appel direct dans le clic, sans rien attendre avant : sinon iOS refuse de lancer le son.
      onClick={() => (isRunning ? playback.toggle() : playback.play(episode))}
    >
      {label}
    </button>
  )
}
