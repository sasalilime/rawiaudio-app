import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createLocalPositionStore } from './localPositionStore.ts'

// Faux localStorage : une Map, ou un stockage qui refuse tout (navigation privée).
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

function refusingStorage(): Storage {
  const refuse = () => {
    throw new DOMException('refusé', 'SecurityError')
  }
  return { length: 0, clear: refuse, getItem: refuse, key: refuse, removeItem: refuse, setItem: refuse }
}

test('enregistre, relit et efface une position (à la seconde)', () => {
  const store = createLocalPositionStore(memoryStorage())

  assert.equal(store.get('fr-001'), null)
  store.save('fr-001', 187.9)
  assert.equal(store.get('fr-001'), 187)
  store.clear('fr-001')
  assert.equal(store.get('fr-001'), null)
})

test('une valeur illisible est ignorée', () => {
  const storage = memoryStorage()
  storage.setItem('rawi:position:fr-001', 'abc')

  assert.equal(createLocalPositionStore(storage).get('fr-001'), null)
})

test('stockage refusé : jamais d’exception, seulement pas de reprise', () => {
  const store = createLocalPositionStore(refusingStorage())

  assert.doesNotThrow(() => store.save('fr-001', 10))
  assert.doesNotThrow(() => store.clear('fr-001'))
  assert.equal(store.get('fr-001'), null)
})
