import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Account } from '../domain/account.ts'
import { InvalidCodeError, UnavailableError } from '../domain/errors.ts'
import type { AuthGateway } from '../ports/authGateway.ts'
import { createAccountSession } from './accountSession.ts'

const parent: Account = { email: 'parent@example.com' }

// Faux serveur : un seul bon code, une session présente ou non, et les appels notés.
function fakeGateway(options: { signedIn?: boolean; offline?: boolean } = {}) {
  const calls: string[] = []
  const gateway: AuthGateway = {
    async requestLogin(email) {
      calls.push(`login ${email}`)
    },
    async verifyCode(email, code) {
      calls.push(`code ${email} ${code}`)
      if (code !== '042917') throw new InvalidCodeError('refusé')
      return { email }
    },
    async verifyLink() {
      return parent
    },
    async currentAccount() {
      if (options.offline) throw new UnavailableError('hors ligne')
      return options.signedIn ? parent : null
    },
    async logout() {
      calls.push('logout')
    },
    async deleteAccount() {
      calls.push('delete')
    },
  }
  return { gateway, calls }
}

test('au démarrage : connecté, déconnecté, ou inconnu hors ligne', async () => {
  for (const [options, expected] of [
    [{ signedIn: true }, 'signedIn'],
    [{}, 'signedOut'],
    [{ offline: true }, 'unknown'],
  ] as const) {
    const session = createAccountSession(fakeGateway(options).gateway)
    await session.load()
    assert.equal(session.getSnapshot().status, expected)
  }
})

test("adresse, puis code : le code part avec l'adresse normalisée", async () => {
  const { gateway, calls } = fakeGateway()
  const session = createAccountSession(gateway)
  await session.requestLogin('  Parent@Example.com ')
  assert.deepEqual(session.getSnapshot(), { status: 'codeSent', email: 'parent@example.com' })

  await assert.rejects(session.verifyCode('000000'), InvalidCodeError)
  assert.equal(session.getSnapshot().status, 'codeSent') // un code faux ne fait pas perdre l'adresse

  await session.verifyCode('042917')
  assert.deepEqual(session.getSnapshot(), { status: 'signedIn', account: parent })
  assert.deepEqual(calls, ['login   Parent@Example.com ', 'code parent@example.com 000000', 'code parent@example.com 042917'])
})

test('changer d’adresse revient au formulaire', async () => {
  const session = createAccountSession(fakeGateway().gateway)
  await session.requestLogin('parent@example.com')
  session.restart()
  assert.equal(session.getSnapshot().status, 'signedOut')
})

test('déconnexion et suppression du compte reviennent à signedOut et préviennent les abonnés', async () => {
  for (const action of ['logout', 'deleteAccount'] as const) {
    const { gateway, calls } = fakeGateway({ signedIn: true })
    const session = createAccountSession(gateway)
    await session.load()
    let notified = 0
    session.subscribe(() => notified++)
    await session[action]()
    assert.equal(session.getSnapshot().status, 'signedOut')
    assert.equal(notified, 1)
    assert.deepEqual(calls, [action === 'logout' ? 'logout' : 'delete'])
  }
})

test('un code sans demande préalable est refusé sans appel', async () => {
  const { gateway, calls } = fakeGateway()
  const session = createAccountSession(gateway)
  await assert.rejects(session.verifyCode('042917'))
  assert.deepEqual(calls, [])
})
