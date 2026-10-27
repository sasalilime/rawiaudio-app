import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AuthGateway } from '../ports/authGateway.ts'
import type { HistoryGateway } from '../ports/historyGateway.ts'
import type { HistoryStore } from '../ports/historyStore.ts'
import { createAccountSession } from './accountSession.ts'
import { startHistorySync } from './historySync.ts'
import { createListeningHistory } from './listeningHistory.ts'

const memoryStore = (initial: string[] = []): HistoryStore => {
  let saved = initial
  return { load: () => saved, save: (ids) => (saved = ids) }
}

const signedInGateway = (signedIn: boolean): AuthGateway => ({
  requestLogin: async () => undefined,
  verifyCode: async (email) => ({ email }),
  verifyLink: async () => ({ email: 'parent@example.com' }),
  currentAccount: async () => (signedIn ? { email: 'parent@example.com' } : null),
  logout: async () => undefined,
  deleteAccount: async () => undefined,
})

// Faux serveur : garde l'union de tout ce qu'il reçoit, et note chaque envoi.
function fakeServer(initial: string[] = []) {
  const sent: string[][] = []
  let heard = new Set(initial)
  const server = {
    sent,
    offline: false,
    remote: {
      async sync(ids) {
        sent.push([...ids].sort())
        if (server.offline) throw new Error('hors ligne')
        heard = new Set([...heard, ...ids])
        return [...heard].sort()
      },
    } satisfies HistoryGateway,
  }
  return server
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

test("à la connexion : l'appareil envoie son historique et récupère celui du compte", async () => {
  const history = createListeningHistory(memoryStore(['fr-001']))
  const account = createAccountSession(signedInGateway(false))
  const { remote, sent } = fakeServer(['fr-002'])
  startHistorySync(history, account, remote)

  await account.requestLogin('parent@example.com')
  await account.verifyCode('042917')
  await settle()
  assert.deepEqual(sent, [['fr-001']])
  assert.deepEqual([...history.getSnapshot()].sort(), ['fr-001', 'fr-002'])
})

test('connecté : chaque épisode entendu part au serveur ; les épisodes reçus ne relancent rien', async () => {
  const history = createListeningHistory(memoryStore())
  const account = createAccountSession(signedInGateway(true))
  await account.load()
  const { remote, sent } = fakeServer(['fr-009'])
  startHistorySync(history, account, remote)
  await settle()
  assert.deepEqual(sent, [[]]) // au démarrage : lecture de l'historique du compte

  history.markHeard('fr-003')
  await settle()
  assert.deepEqual(sent, [[], ['fr-003', 'fr-009']])
  assert.deepEqual([...history.getSnapshot()].sort(), ['fr-003', 'fr-009'])
})

test('déconnecté : rien ne part', async () => {
  const history = createListeningHistory(memoryStore())
  const account = createAccountSession(signedInGateway(false))
  await account.load()
  const { remote, sent } = fakeServer()
  startHistorySync(history, account, remote)
  history.markHeard('fr-001')
  await settle()
  assert.deepEqual(sent, [])
})

test("hors ligne : l'historique local reste, et la synchro suivante rattrape tout", async () => {
  const history = createListeningHistory(memoryStore())
  const account = createAccountSession(signedInGateway(true))
  await account.load()
  const server = fakeServer()
  server.offline = true
  startHistorySync(history, account, server.remote)
  history.markHeard('fr-001')
  history.markHeard('fr-002')
  await settle()
  assert.deepEqual([...history.getSnapshot()].sort(), ['fr-001', 'fr-002'])

  // De retour en ligne, le prochain épisode entendu emporte aussi les deux manqués.
  server.offline = false
  history.markHeard('fr-003')
  await settle()
  assert.deepEqual(server.sent.at(-1), ['fr-001', 'fr-002', 'fr-003'])
})
