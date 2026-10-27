import { createAudioPlayer, setAudioModeAsync } from 'expo-audio'
import type { AudioPlayer, PlayerEvent } from '@rawiaudio/shared/core/ports/audioPlayer.ts'
import { NOTHING_REPORTED, playerEvents } from './playerEvents.ts'

/** L'unique lecteur de l'appli, sur expo-audio, avec les commandes de l'écran verrouillé. */
export function createExpoAudioPlayer(): AudioPlayer {
  const player = createAudioPlayer(null, { updateInterval: 500 })
  // Son même en mode silencieux, et en arrière-plan (UIBackgroundModes et service Android : plugin dans app.json).
  setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch(
    (error: unknown) => console.warn('mode audio refusé', error),
  )

  const listeners = new Set<(event: PlayerEvent) => void>()
  const emit = (event: PlayerEvent) => listeners.forEach((listener) => listener(event))
  let reported = NOTHING_REPORTED
  let pendingStart = 0

  player.addListener('playbackStatusUpdate', (status) => {
    // On ne peut se placer qu'une fois la durée connue.
    if (pendingStart > 0 && status.isLoaded && status.duration > 0) {
      void player.seekTo(pendingStart)
      pendingStart = 0
    }
    const [events, next] = playerEvents(status, reported)
    reported = next
    events.forEach(emit)
  })

  return {
    load(src, startAt, track) {
      // Changer de source arrête la lecture : pas un « paused » à signaler, la session attend déjà le nouvel épisode.
      reported = NOTHING_REPORTED
      pendingStart = startAt
      player.replace({ uri: src })
      // ponytail: sauts de l'écran verrouillé gérés par expo-audio ; « partie suivante » quand le besoin viendra.
      player.setActiveForLockScreen(true, track, { showSeekBackward: true, showSeekForward: true })
    },
    play() {
      // Contrairement au navigateur, le natif ne refuse jamais le son faute de geste : rien à rejeter.
      player.play()
      return Promise.resolve()
    },
    pause: () => player.pause(),
    seekTo(seconds) {
      void player.seekTo(seconds)
    },
    position: () => player.currentTime,
    onEvent(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
