/** Ce que l'écran verrouillé affiche pendant la lecture. */
export interface TrackMetadata {
  title: string
  artist: string
  artworkUrl: string
}

export type PlayerEvent = 'playing' | 'paused' | 'waiting' | 'time' | 'ended' | 'error'

/**
 * Le lecteur audio : un seul pour toute l'appli. Implémenté dans infra/audio.
 * Il gère aussi les commandes de l'écran verrouillé (lecture, pause, sauts), qui produisent les mêmes événements.
 */
export interface AudioPlayer {
  /** Remplace la source et se placera à startAt (secondes) dès que possible. Ne lance pas la lecture. */
  load(src: string, startAt: number, metadata: TrackMetadata): void
  /**
   * Lance la lecture. Sur iOS, doit être appelée directement dans le geste de l'utilisateur, sans attente avant.
   * Rejette PlaybackBlockedError si le navigateur refuse.
   */
  play(): Promise<void>
  pause(): void
  seekTo(seconds: number): void
  /** Position courante, en secondes. */
  position(): number
  /** Écoute les événements du lecteur ; renvoie la fonction de désabonnement. */
  onEvent(listener: (event: PlayerEvent) => void): () => void
}
