import type { HistoryGateway } from '../ports/historyGateway.ts'
import type { AccountSession } from './accountSession.ts'
import type { ListeningHistory } from './listeningHistory.ts'

/**
 * Synchronise l'historique d'écoute avec le compte (ADR-0007), tant qu'on est connecté :
 * à la connexion, au démarrage (connexion déjà ouverte), et à chaque épisode entendu.
 * Chaque fois, l'appareil envoie tout ce qu'il a entendu et garde l'union renvoyée : une synchro manquée
 * (hors ligne) est rattrapée par la suivante. Renvoie la fonction qui arrête la synchronisation.
 */
export function startHistorySync(history: ListeningHistory, account: AccountSession, remote: HistoryGateway): () => void {
  let running = false
  let again = false // un épisode entendu pendant une synchro : on en refait une juste après
  let merging = false // les épisodes apportés par le serveur ne relancent pas de synchro

  async function sync() {
    if (account.getSnapshot().status !== 'signedIn') return
    if (running) {
      again = true
      return
    }
    running = true
    try {
      do {
        again = false
        const all = await remote.sync([...history.getSnapshot()])
        merging = true
        history.merge(all)
        merging = false
      } while (again)
    } catch {
      // Hors ligne, ou session tombée : l'historique local suffit, la prochaine synchro rattrapera.
    } finally {
      merging = false
      running = false
    }
  }

  let wasSignedIn = account.getSnapshot().status === 'signedIn'
  const stopAccount = account.subscribe(() => {
    const signedIn = account.getSnapshot().status === 'signedIn'
    if (signedIn && !wasSignedIn) void sync()
    wasSignedIn = signedIn
  })
  const stopHistory = history.subscribe(() => {
    if (!merging) void sync()
  })
  if (wasSignedIn) void sync()

  return () => {
    stopAccount()
    stopHistory()
  }
}
