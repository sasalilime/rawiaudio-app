/** Les fichiers audio enregistrés sur l'appareil, rangés par identifiant d'épisode. Implémenté dans infra/offline. */
export interface OfflineAudioStore {
  /** Identifiants des épisodes déjà enregistrés. */
  list(): Promise<string[]>
  /**
   * Télécharge le fichier à url et l'enregistre sous l'identifiant de l'épisode (jamais sous l'URL, qui change).
   * onProgress reçoit la part déjà reçue, entre 0 et 1, quand la taille est connue.
   */
  save(episodeId: string, url: string, onProgress: (fraction: number) => void): Promise<void>
  remove(episodeId: string): Promise<void>
  /** Garde l'illustration d'un épisode téléchargé (ADR-0009), pour l'afficher sans réseau. */
  saveImage(url: string): Promise<void>
  /**
   * Adresse locale de l'illustration gardée, ou null. Null aussi dans la PWA : son service worker sert
   * la copie sous l'adresse en ligne, qui ne change jamais. Synchrone : l'affichage ne doit rien attendre.
   */
  localImageUrl(url: string): string | null
  /** Adresse locale à donner au lecteur. */
  localUrl(episodeId: string): string
  /** Demande au navigateur de ne pas effacer les téléchargements quand l'espace manque. */
  persist(): Promise<boolean>
}
