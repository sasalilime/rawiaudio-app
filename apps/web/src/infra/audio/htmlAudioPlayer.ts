import { PlaybackBlockedError } from '@rawiaudio/shared/core/domain/errors.ts'
import type { AudioPlayer, PlayerEvent, TrackMetadata } from '@rawiaudio/shared/core/ports/audioPlayer.ts'

/** Durée des sauts de l'écran verrouillé quand le système n'en propose pas. */
const DEFAULT_SKIP_SECONDS = 15

/**
 * L'unique élément <audio> de l'appli, et les commandes de l'écran verrouillé (Media Session).
 * Jamais Web Audio : iOS coupe le son de Web Audio en arrière-plan.
 */
export function createHtmlAudioPlayer(doc: Document): AudioPlayer {
  const audio = doc.createElement('audio')
  audio.preload = 'auto'
  doc.body.append(audio) // sans attribut controls : rien ne s'affiche

  const listeners = new Set<(event: PlayerEvent) => void>()
  const emit = (event: PlayerEvent) => listeners.forEach((listener) => listener(event))
  let metadata: TrackMetadata | null = null
  let pendingStart = 0

  // Avant les métadonnées, iOS ignore currentTime : on se place au départ voulu dès qu'il est possible.
  audio.addEventListener('loadedmetadata', () => {
    if (pendingStart > 0) audio.currentTime = pendingStart
    pendingStart = 0
  })
  audio.addEventListener('playing', () => {
    registerMediaSession() // dans « playing » : avant, iOS ignore les actions (CLAUDE.md)
    emit('playing')
  })
  audio.addEventListener('pause', () => emit('paused'))
  audio.addEventListener('waiting', () => emit('waiting'))
  audio.addEventListener('timeupdate', () => emit('time'))
  audio.addEventListener('seeked', updatePositionState)
  audio.addEventListener('ended', () => emit('ended'))
  audio.addEventListener('error', () => emit('error'))

  function registerMediaSession() {
    if (!('mediaSession' in navigator) || !metadata) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title: metadata.title,
      artist: metadata.artist,
      // Sans taille ni type : c'est l'illustration de l'épisode (WebP 16:9) ou l'icône de l'appli (PNG carré).
      artwork: [{ src: metadata.artworkUrl }],
    })
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => void audio.play().catch(() => undefined)], // refus : l'état reste « en pause », visible
      ['pause', () => audio.pause()],
      ['seekbackward', (details) => seekBy(-(details.seekOffset ?? DEFAULT_SKIP_SECONDS))],
      ['seekforward', (details) => seekBy(details.seekOffset ?? DEFAULT_SKIP_SECONDS)],
      ['seekto', (details) => details.seekTime !== undefined && (audio.currentTime = details.seekTime)],
    ]
    for (const [action, handler] of handlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // action inconnue de ce navigateur : le bouton n'apparaît simplement pas
      }
    }
    updatePositionState()
  }

  function seekBy(seconds: number) {
    const duration = Number.isFinite(audio.duration) ? audio.duration : Number.POSITIVE_INFINITY
    audio.currentTime = Math.min(Math.max(audio.currentTime + seconds, 0), duration)
  }

  // La barre de progression de l'écran verrouillé.
  function updatePositionState() {
    if (!('mediaSession' in navigator) || !Number.isFinite(audio.duration)) return
    try {
      navigator.mediaSession.setPositionState({
        duration: audio.duration,
        playbackRate: audio.playbackRate,
        position: Math.min(audio.currentTime, audio.duration),
      })
    } catch {
      // valeurs refusées par le navigateur (durée encore inconnue) : la barre se mettra à jour au prochain saut
    }
  }

  return {
    load(src, startAt, track) {
      metadata = track
      pendingStart = startAt
      audio.src = src
    },
    play() {
      return audio.play().catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return // source remplacée : pas une erreur
        if (error instanceof DOMException && error.name === 'NotAllowedError') {
          throw new PlaybackBlockedError('lecture refusée sans geste', { cause: error })
        }
        throw error
      })
    },
    pause: () => audio.pause(),
    seekTo(seconds) {
      audio.currentTime = seconds
    },
    position: () => audio.currentTime,
    onEvent(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
