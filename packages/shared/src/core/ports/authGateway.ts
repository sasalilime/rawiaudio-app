import type { Account } from '../domain/account.ts'

/**
 * Connexion par e-mail auprès de l'API (ADR-0012). Implémenté dans http/ : la PWA garde la session dans un cookie,
 * l'app mobile dans le trousseau du téléphone ; le cœur n'en sait rien.
 * Lève InvalidEmailError, InvalidCodeError, TooManyRequestsError, ou UnavailableError (hors ligne, serveur en panne).
 */
export interface AuthGateway {
  /** Envoie l'e-mail avec le code et le lien. S'inscrire = se connecter. */
  requestLogin(email: string): Promise<void>
  verifyCode(email: string, code: string): Promise<Account>
  /** token : le jeton du lien de l'e-mail (après « #jeton= »). */
  verifyLink(token: string): Promise<Account>
  /** Le compte de la session, ou null s'il n'y en a pas (ou plus). */
  currentAccount(): Promise<Account | null>
  logout(): Promise<void>
  /** Supprime le compte et toutes ses sessions, sur tous les appareils. */
  deleteAccount(): Promise<void>
}
