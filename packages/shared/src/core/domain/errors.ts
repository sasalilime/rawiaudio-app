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

/** Adresse e-mail refusée (connexion, ADR-0012). */
export class InvalidEmailError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'InvalidEmailError'
  }
}

/** Code ou lien de connexion refusé : faux, expiré, déjà utilisé, ou essais épuisés. Le serveur ne dit pas lequel. */
export class InvalidCodeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'InvalidCodeError'
  }
}

/** Trop de demandes ; retryAfterSeconds dit combien de temps attendre, quand le serveur le donne. */
export class TooManyRequestsError extends Error {
  readonly retryAfterSeconds: number | null

  constructor(message: string, retryAfterSeconds: number | null, options?: ErrorOptions) {
    super(message, options)
    this.name = 'TooManyRequestsError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}
