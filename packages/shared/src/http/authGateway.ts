import type { Account } from '../core/domain/account.ts'
import { InvalidCodeError, InvalidEmailError, TooManyRequestsError, UnavailableError } from '../core/domain/errors.ts'
import type { AuthGateway } from '../core/ports/authGateway.ts'
import { ApiError, type Api } from './apiClient.ts'
import type { Client } from './types.ts'

/**
 * Où l'app mobile garde son jeton de session : le trousseau du téléphone (expo-secure-store).
 * La PWA n'en a pas besoin : son jeton est dans un cookie HttpOnly, que son JavaScript ne voit jamais.
 */
export interface TokenStore {
  get(): Promise<string | null>
  set(token: string): Promise<void>
  clear(): Promise<void>
}

/**
 * Implémente AuthGateway avec l'API Rawi.
 *   - client « web » (PWA) : l'API pose le cookie ; createApi doit avoir credentials « include ».
 *   - client « app » (mobile) : l'API renvoie le jeton, gardé dans tokens ; createApi doit le lire dans tokens.
 */
export function createHttpAuthGateway(api: Api, client: Client, tokens?: TokenStore): AuthGateway {
  if (client === 'app' && !tokens) throw new Error("l'app mobile a besoin d'un TokenStore")

  async function open(session: Promise<{ account: Account; token?: string }>): Promise<Account> {
    const { account, token } = await translateErrors(session)
    if (client === 'app') {
      if (!token) throw new UnavailableError('jeton de session absent de la réponse')
      await tokens?.set(token)
    }
    return { email: account.email }
  }

  return {
    async requestLogin(email) {
      await translateErrors(api.requestLogin(email))
    },
    verifyCode: (email, code) => open(api.verifyCode(email, code, client)),
    verifyLink: (token) => open(api.verifyLink(token, client)),
    async currentAccount() {
      // Sans jeton, l'app sait qu'elle n'a pas de session : pas besoin du réseau, et ça marche hors ligne.
      if (client === 'app' && !(await tokens?.get())) return null
      try {
        const account = await api.getAccount()
        return { email: account.email }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await tokens?.clear() // session expirée ou fermée ailleurs : le jeton ne sert plus
          return null
        }
        throw new UnavailableError('API injoignable', { cause: error })
      }
    },
    async logout() {
      try {
        await api.logout()
      } catch (error) {
        // Déjà fermée côté serveur : le but est atteint. Hors ligne, la PWA garde son cookie : on le dit.
        if (!(error instanceof ApiError && error.status === 401) && client === 'web') {
          throw new UnavailableError('API injoignable', { cause: error })
        }
      } finally {
        // L'app oublie son jeton même hors ligne : sur ce téléphone, plus personne n'est connecté.
        await tokens?.clear()
      }
    },
    async deleteAccount() {
      await translateErrors(api.deleteAccount())
      await tokens?.clear()
    },
  }
}

// Le cœur ne connaît pas ApiError : on la traduit dans les erreurs qu'il définit.
async function translateErrors<T>(request: Promise<T>): Promise<T> {
  try {
    return await request
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === 'invalid_email') throw new InvalidEmailError('adresse refusée', { cause: error })
      if (error.code === 'invalid_code') throw new InvalidCodeError('code ou lien refusé', { cause: error })
      if (error.status === 429) throw new TooManyRequestsError('trop de demandes', error.retryAfterSeconds, { cause: error })
    }
    throw new UnavailableError('API injoignable', { cause: error })
  }
}
