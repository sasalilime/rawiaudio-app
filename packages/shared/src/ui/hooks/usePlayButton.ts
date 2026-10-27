import { useEffect } from 'react'
import type { EpisodeSummary } from '../../core/domain/episode.ts'
import { formatClock } from '../format.ts'
import { fr } from '../i18n/fr.ts'
import { usePlayback } from './usePlayback.ts'

/**
 * Le bouton principal d'une fiche : écouter, reprendre ou mettre en pause cet épisode.
 * Renvoie son libellé et la fonction à appeler directement dans le geste (exigence d'iOS).
 */
export function usePlayButton(episode: EpisodeSummary): [string, () => void] {
  const [snapshot, playback] = usePlayback()
  const isCurrent = snapshot.episode?.id === episode.id
  const isRunning = isCurrent && (snapshot.status === 'playing' || snapshot.status === 'loading')

  // Dès l'ouverture de la fiche : l'URL sera prête, et le geste lancera le son sans attente.
  useEffect(() => playback.prepare(episode), [playback, episode])

  const resumeAt = isCurrent ? snapshot.position : playback.resumeAt(episode)
  const label = isRunning ? fr.pause : resumeAt > 0 && snapshot.status !== 'ended' ? fr.resumeAt(formatClock(resumeAt)) : fr.play

  return [label, () => (isRunning ? playback.toggle() : playback.play(episode))]
}
