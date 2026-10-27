import type { AudioStatus } from 'expo-audio'
import type { PlayerEvent } from '@rawiaudio/shared/core/ports/audioPlayer.ts'

/** Ce que le lecteur a déjà signalé : on ne signale que les changements. */
export interface Reported {
  playing: boolean
  buffering: boolean
  error: string | null
}

export const NOTHING_REPORTED: Reported = { playing: false, buffering: false, error: null }

type Status = Pick<AudioStatus, 'playing' | 'isBuffering' | 'didJustFinish' | 'error'>

/**
 * expo-audio ne donne qu'un état, toutes les 500 ms et à chaque changement : on en déduit les événements
 * du port (comme ceux d'un élément <audio>), et ce qui est désormais signalé.
 */
export function playerEvents(status: Status, reported: Reported): [PlayerEvent[], Reported] {
  if (status.error && status.error !== reported.error) {
    return [['error'], { ...reported, playing: false, error: status.error }]
  }
  if (status.didJustFinish) return [['ended'], { ...reported, playing: false }]

  const events: PlayerEvent[] = []
  const next = { ...reported }
  if (status.playing !== reported.playing) {
    next.playing = status.playing
    events.push(status.playing ? 'playing' : 'paused')
  } else if (status.isBuffering !== reported.buffering) {
    next.buffering = status.isBuffering
    if (status.isBuffering) events.push('waiting')
    else if (status.playing) events.push('playing') // fin d'une attente pendant la lecture
  }
  events.push('time')
  return [events, next]
}
