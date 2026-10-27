// Erreurs que l'interface sait expliquer. Les implémentations (infra) traduisent leurs erreurs vers celles-ci.

/** L'élément demandé n'existe pas, ou n'est pas encore publié. */
export class NotFoundError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'NotFoundError'
  }
}

/** Le navigateur a refusé de lancer le son sans un geste de l'utilisateur (iOS surtout). Un nouvel appui suffit. */
export class PlaybackBlockedError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PlaybackBlockedError'
  }
}

/** Le service est injoignable : hors ligne, ou serveur en panne. Réessayer peut suffire. */
export class UnavailableError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'UnavailableError'
  }
}
