import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Episode } from '../../core/domain/episode.ts'
import { createLocalCatalogCache } from './localCatalogCache.ts'

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

const fiche: Episode = {
  id: 'fr-001',
  number: 1,
  slug: 'un',
  title: 'Un',
  reference: 'Réf 1',
  durationSeconds: 392,
  publishedAt: new Date('2026-10-16T00:00:00Z'),
  series: { id: 'fr-al-kahf', title: 'Al-Kahf' },
  summary: ['p'],
  sources: [{ label: 'Saadi', url: 'https://shamela.ws/book/42' }],
}

test('liste et fiche relues à l’identique, dates comprises', () => {
  const cache = createLocalCatalogCache(memoryStorage())
  cache.saveList('fr', [fiche])
  cache.saveEpisode(fiche)

  const list = cache.getList('fr')
  assert.ok(list?.[0]?.publishedAt instanceof Date)
  assert.deepEqual(list, [fiche])
  assert.deepEqual(cache.getEpisode('fr-001'), fiche)
  assert.equal(cache.getList('ar'), null)
})

test('contenu illisible : comme si rien n’était gardé', () => {
  const storage = memoryStorage()
  storage.setItem('rawi:catalog:fr', '{pas du json')

  assert.equal(createLocalCatalogCache(storage).getList('fr'), null)
})
