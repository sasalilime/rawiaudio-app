import { test } from 'node:test'
import assert from 'node:assert/strict'
import { episodePath, parseRoute } from './router.ts'

test('reconnaît les pages', () => {
  assert.deepEqual(parseRoute('/'), { name: 'catalog' })
  assert.deepEqual(parseRoute('/episodes/fr-001'), { name: 'episode', id: 'fr-001' })
  assert.deepEqual(parseRoute('/episodes/fr-001/'), { name: 'episode', id: 'fr-001' })
})

test('tout le reste est introuvable', () => {
  for (const path of ['/episodes', '/episodes/fr-1', '/episodes/FR-001', '/episodes/fr-001/audio', '/autre']) {
    assert.deepEqual(parseRoute(path), { name: 'not-found' }, path)
  }
})

test('construit le chemin d’un épisode', () => {
  assert.equal(episodePath('fr-001'), '/episodes/fr-001')
  assert.deepEqual(parseRoute(episodePath('ar-012')), { name: 'episode', id: 'ar-012' })
})
