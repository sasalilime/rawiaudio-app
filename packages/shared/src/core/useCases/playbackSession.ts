import type { EpisodeSummary } from '../domain/episode.ts'
import { PlaybackBlockedError } from '../domain/errors.ts'
import { isHeard } from '../domain/listening.ts'
import { clampPosition, isUrlUsable, resumePosition, type AudioUrl } from '../domain/playback.ts'
import type { AudioPlayer, TrackMetadata } from '../ports/audioPlayer.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'
import type { PositionStore } from '../ports/positionStore.ts'

export type PlaybackStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'blocked' | 'error'

export interface PlaybackSnapshot {
  episode: EpisodeSummary | null
  status: PlaybackStatus
  /** Position en secondes. */
  position: number
}

export interface PlaybackSession {
  getSnapshot(): PlaybackSnapshot
  subscribe(listener: () => void): () => void
  /** Demande l'URL à l'avance (à l'ouverture de la fiche), pour que play n'ait rien à attendre. */
  prepare(episode: EpisodeSummary): void
  /** Position à laquelle play reprendrait cet épisode. */
  resumeAt(episode: EpisodeSummary): number
  /** À appeler directement dans le geste de l'utilisateur (clic), sans attente avant. */
  play(episode: EpisodeSummary): void
  toggle(): void
  seekBy(seconds: number): void
  seekTo(seconds: number): void
}

export interface PlaybackDeps {
  episodes: EpisodeRepository
  player: AudioPlayer
  positions: PositionStore
  now: () => Date
  /** Titre, artiste et image de l'écran verrouillé : les textes viennent de l'interface. */
  describe: (episode: EpisodeSummary) => TrackMetadata
  /** Adresse de la copie téléchargée, ou null : toujours préférée au réseau, même en ligne. */
  localSource: (episodeId: string) => string | null
  /** La partie suivante de la même série, enchaînée à la fin de celle-ci ; null pour une histoire indépendante. */
  nextPart: (episode: EpisodeSummary) => EpisodeSummary | null
  /** Appelée une fois par écoute, quand l'épisode compte comme entendu (95 %, ADR-0007). */
  onHeard: (episodeId: string) => void
}

/** Intervalle minimal entre deux enregistrements de la position pendant la lecture. */
const SAVE_INTERVAL_MS = 5_000

/** Une copie locale n'expire jamais (plus grande date représentable). */
const NEVER = new Date(8.64e15)

/** La lecture d'un épisode à la fois, pour toute l'appli. */
export function createPlaybackSession(deps: PlaybackDeps): PlaybackSession {
  const { episodes, player, positions, now, describe, localSource, nextPart, onHeard } = deps
  const urls = new Map<string, AudioUrl>() // dernière URL obtenue, par épisode
  const requests = new Map<string, Promise<AudioUrl>>() // demandes en cours, pour ne pas les doubler
  // Épisode chargé dans le lecteur ; null pendant qu'on attend une URL.
  let current: { episode: EpisodeSummary; url: AudioUrl } | null = null
  let snapshot: PlaybackSnapshot = { episode: null, status: 'idle', position: 0 }
  let lastSave = 0
  let heardReported = false // une seule annonce « entendu » par écoute
  const listeners = new Set<() => void>()

  // React compare les instantanés par référence : un nouvel objet à chaque changement, jamais de mutation.
  function update(patch: Partial<PlaybackSnapshot>) {
    snapshot = { ...snapshot, ...patch }
    for (const listener of listeners) listener()
  }

  function usableUrl(id: string): AudioUrl | null {
    const url = urls.get(id)
    return url && isUrlUsable(url, now()) ? url : null
  }

  function fetchUrl(id: string): Promise<AudioUrl> {
    const usable = usableUrl(id)
    if (usable) return Promise.resolve(usable)
    let request = requests.get(id)
    if (!request) {
      request = episodes
        .getAudioUrl(id)
        .then((url) => {
          urls.set(id, url)
          return url
        })
        .finally(() => requests.delete(id))
      requests.set(id, request)
    }
    return request
  }

  function savePosition() {
    if (!current) return
    lastSave = now().getTime()
    const position = player.position()
    if (position > 0) positions.save(current.episode.id, position)
  }

  function playNow(episode: EpisodeSummary) {
    player.play().catch((error: unknown) => {
      if (current?.episode.id !== episode.id) return // un autre épisode a été lancé entre-temps
      update({ status: error instanceof PlaybackBlockedError ? 'blocked' : 'error' })
    })
  }

  // Charge et lance aussitôt : rien n'est attendu entre le geste de l'utilisateur et player.play().
  function start(episode: EpisodeSummary, url: AudioUrl, startAt: number) {
    current = { episode, url }
    heardReported = false
    player.load(url.url, startAt, describe(episode))
    update({ episode, status: 'loading', position: startAt })
    playNow(episode)
    // La partie suivante prête d'avance : l'enchaînement n'aura rien à attendre.
    const next = nextPart(episode)
    if (next) prepare(next)
  }

  // Lance un épisode depuis sa position de reprise, de préférence depuis la copie téléchargée.
  function begin(episode: EpisodeSummary) {
    const startAt = resumePosition(positions.get(episode.id), episode.durationSeconds)
    const local = localSource(episode.id)
    const url = local ? { url: local, expiresAt: NEVER } : usableUrl(episode.id)
    if (url) start(episode, url, startAt)
    else startAfterFetch(episode, startAt)
  }

  function prepare(episode: EpisodeSummary) {
    if (localSource(episode.id)) return
    // Échec ignoré exprès : play redemandera l'URL et affichera l'erreur s'il le faut.
    fetchUrl(episode.id).catch(() => undefined)
  }

  function reportHeard(episode: EpisodeSummary) {
    if (heardReported) return
    heardReported = true
    onHeard(episode.id)
  }

  // Sans URL utilisable, il faut d'abord en demander une : iOS peut alors refuser le son (statut blocked).
  function startAfterFetch(episode: EpisodeSummary, startAt: number, forceNewUrl = false) {
    if (forceNewUrl) urls.delete(episode.id)
    current = null
    update({ episode, status: 'loading', position: startAt })
    fetchUrl(episode.id).then(
      (url) => {
        // L'utilisateur a pu changer d'épisode ou mettre en pause pendant l'attente.
        if (snapshot.episode?.id === episode.id && snapshot.status === 'loading') start(episode, url, startAt)
      },
      () => {
        if (snapshot.episode?.id === episode.id) update({ status: 'error' })
      },
    )
  }

  function seekTo(seconds: number) {
    if (!current) return
    const position = clampPosition(seconds, current.episode.durationSeconds)
    player.seekTo(position)
    update({ position })
  }

  function resume() {
    const episode = snapshot.episode
    if (!episode) return
    if (current && snapshot.status !== 'error' && isUrlUsable(current.url, now())) {
      playNow(episode)
      return
    }
    // URL expirée pendant la pause, ou erreur : une URL neuve, et on reprend au même endroit.
    const at = snapshot.status === 'ended' ? 0 : current ? player.position() : snapshot.position
    startAfterFetch(episode, at, snapshot.status === 'error')
  }

  player.onEvent((event) => {
    if (!current) return
    const { episode, url } = current
    switch (event) {
      case 'playing':
        update({ status: 'playing', position: player.position() })
        return
      case 'waiting':
        update({ status: 'loading' })
        return
      case 'paused':
        savePosition()
        update({ status: 'paused', position: player.position() })
        return
      case 'time': {
        const position = player.position()
        update({ position })
        if (now().getTime() - lastSave >= SAVE_INTERVAL_MS) savePosition()
        if (isHeard(position, episode.durationSeconds)) reportHeard(episode)
        return
      }
      case 'ended': {
        positions.clear(episode.id)
        reportHeard(episode)
        // Lecture enchaînée : la partie suivante de la même série, jamais une autre histoire (ADR-0007).
        const next = nextPart(episode)
        if (next) begin(next)
        else update({ status: 'ended', position: episode.durationSeconds })
        return
      }
      case 'error':
        // Le plus souvent, l'URL a expiré pendant une longue pause : une seule tentative avec une URL neuve.
        if (isUrlUsable(url, now())) update({ status: 'error' })
        else startAfterFetch(episode, player.position())
        return
    }
  })

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    prepare,
    resumeAt: (episode) => resumePosition(positions.get(episode.id), episode.durationSeconds),
    play(episode) {
      if (snapshot.episode?.id === episode.id && snapshot.status !== 'idle') {
        resume()
        return
      }
      savePosition()
      if (current) player.pause()
      begin(episode)
    },
    toggle() {
      if (snapshot.status === 'playing') {
        player.pause()
      } else if (snapshot.status === 'loading') {
        if (current) player.pause()
        else update({ status: 'paused' }) // URL encore attendue : la lecture ne partira pas
      } else {
        resume()
      }
    },
    seekBy(seconds) {
      if (current) seekTo(player.position() + seconds)
    },
    seekTo,
  }
}
