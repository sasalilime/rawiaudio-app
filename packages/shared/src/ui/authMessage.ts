import { InvalidCodeError, InvalidEmailError, TooManyRequestsError } from '../core/domain/errors.ts'
import { fr } from './i18n/fr.ts'

/** Le message à afficher pour une erreur de connexion. Toute autre erreur : service injoignable. */
export function authMessage(error: unknown): string {
  if (error instanceof InvalidEmailError) return fr.invalidEmail
  if (error instanceof InvalidCodeError) return fr.invalidCode
  if (error instanceof TooManyRequestsError) {
    return fr.tooManyRequests(error.retryAfterSeconds === null ? null : Math.ceil(error.retryAfterSeconds / 60))
  }
  return fr.authUnavailable
}
