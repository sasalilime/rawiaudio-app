import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalHistoryStore } from './localHistoryStore.ts'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => {
      data.delete(k)
    },
    setItem: (k, v) => {
      data.set(k, v)
    },
  }
}

test('enregistre et relit les épisodes entendus', () => {
  const store = createLocalHistoryStore(memoryStorage())

  assert.deepEqual(store.load(), [])
  store.save(['fr-001', 'fr-004'])
  assert.deepEqual(store.load(), ['fr-001', 'fr-004'])
})

test('contenu illisible ou inattendu : historique vide ou filtré', () => {
  const storage = memoryStorage()
  storage.setItem('rawi:heard', '{pas du json')
  assert.deepEqual(createLocalHistoryStore(storage).load(), [])

  storage.setItem('rawi:heard', JSON.stringify(['fr-001', 42, null]))
  assert.deepEqual(createLocalHistoryStore(storage).load(), ['fr-001'])
})
