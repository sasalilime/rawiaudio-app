import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aboutPath, accountPath, episodePath, linkToken, parseRoute, seriesPath, signInPath } from './router.ts'

test('reconnaît les pages', () => {
  assert.deepEqual(parseRoute('/'), { name: 'catalog' })
  assert.deepEqual(parseRoute('/episodes/fr-001'), { name: 'episode', id: 'fr-001' })
  assert.deepEqual(parseRoute('/episodes/fr-001/'), { name: 'episode', id: 'fr-001' })
  assert.deepEqual(parseRoute('/series/fr-moussa-et-pharaon'), { name: 'series', id: 'fr-moussa-et-pharaon' })
  assert.deepEqual(parseRoute(seriesPath('ar-yusuf')), { name: 'series', id: 'ar-yusuf' })
  assert.deepEqual(parseRoute('/connexion/'), { name: 'signIn' })
  assert.deepEqual(parseRoute('/compte/'), { name: 'account' })
})

test('tout le reste est introuvable', () => {
  for (const path of ['/episodes', '/episodes/fr-1', '/episodes/FR-001', '/episodes/fr-001/audio', '/series', '/series/Moussa', '/series/fr-', '/connexion/code', '/comptes', '/autre']) {
    assert.deepEqual(parseRoute(path), { name: 'not-found' }, path)
  }
})

test('construit le chemin d’un épisode', () => {
  assert.equal(episodePath('fr-001'), '/episodes/fr-001')
  assert.deepEqual(parseRoute(episodePath('ar-012')), { name: 'episode', id: 'ar-012' })
})

test('construit les chemins de la connexion et du compte', () => {
  assert.deepEqual(parseRoute(signInPath()), { name: 'signIn' })
  assert.deepEqual(parseRoute(accountPath()), { name: 'account' })
  assert.deepEqual(parseRoute(aboutPath()), { name: 'about' })
  assert.deepEqual(parseRoute('/a-propos/'), { name: 'about' })
})

test('lit le jeton du lien de connexion dans le fragment', () => {
  const token = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_abcde'
  assert.equal(linkToken(`#jeton=${token}`), token)
  for (const hash of ['', '#', '#jeton=', `#jeton=${token}x`, `#jeton=${token.slice(1)}`, `#jeton=${token.slice(1)}=`, `#token=${token}`, `#jeton=${token}&a=1`]) {
    assert.equal(linkToken(hash), null, hash)
  }
})
