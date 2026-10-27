import type { Account } from '../domain/account.ts'
import type { AuthGateway } from '../ports/authGateway.ts'

/**
 * Où en est la connexion :
 *   - unknown : pas encore vérifié auprès du serveur (démarrage, ou hors ligne) ;
 *   - signedOut : pas de compte sur cet appareil ;
 *   - codeSent : l'e-mail est parti, on attend le code ;
 *   - signedIn : connecté.
 */
export type AccountState =
  | { status: 'unknown' }
  | { status: 'signedOut' }
  | { status: 'codeSent'; email: string }
  | { status: 'signedIn'; account: Account }

/**
 * La session de compte de l'appareil. Les actions lèvent les erreurs de AuthGateway : l'écran les explique
 * (adresse refusée, code faux, trop de demandes, hors ligne), l'état ne change alors pas.
 */
export interface AccountSession {
  getSnapshot(): AccountState
  subscribe(listener: () => void): () => void
  /** Demande au serveur s'il y a une session. Hors ligne, l'état reste unknown. */
  load(): Promise<void>
  requestLogin(email: string): Promise<void>
  /** Vérifie le code de l'e-mail envoyé à l'adresse de requestLogin. */
  verifyCode(code: string): Promise<void>
  verifyLink(token: string): Promise<void>
  /** Revient au formulaire d'adresse (faute de frappe, e-mail jamais arrivé). */
  restart(): void
  logout(): Promise<void>
  deleteAccount(): Promise<void>
}

export function createAccountSession(gateway: AuthGateway): AccountSession {
  let state: AccountState = { status: 'unknown' }
  const listeners = new Set<() => void>()

  function set(next: AccountState) {
    state = next
    for (const listener of listeners) listener()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    async load() {
      try {
        const account = await gateway.currentAccount()
        // Une demande de code en cours n'est pas effacée par une vérification lancée avant elle.
        if (state.status === 'unknown') set(account ? { status: 'signedIn', account } : { status: 'signedOut' })
      } catch {
        // Hors ligne ou serveur en panne : on ne sait pas, l'état reste unknown et l'écran propose de réessayer.
      }
    },
    async requestLogin(email) {
      await gateway.requestLogin(email)
      // L'adresse telle que le serveur la garde : sans espaces, en minuscules.
      set({ status: 'codeSent', email: email.trim().toLowerCase() })
    },
    async verifyCode(code) {
      if (state.status !== 'codeSent') throw new Error('aucun code demandé')
      const account = await gateway.verifyCode(state.email, code)
      set({ status: 'signedIn', account })
    },
    async verifyLink(token) {
      const account = await gateway.verifyLink(token)
      set({ status: 'signedIn', account })
    },
    restart() {
      if (state.status === 'codeSent') set({ status: 'signedOut' })
    },
    async logout() {
      await gateway.logout()
      set({ status: 'signedOut' })
    },
    async deleteAccount() {
      await gateway.deleteAccount()
      set({ status: 'signedOut' })
    },
  }
}
