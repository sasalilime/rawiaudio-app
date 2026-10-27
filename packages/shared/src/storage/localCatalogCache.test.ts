import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Episode } from '../core/domain/episode.ts'
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
  series: { id: 'fr-moussa', title: 'Moussa et Pharaon', part: 2 },
  themes: [{ id: 'fr-histoires-du-coran', title: 'Histoires du Coran', position: 1 }],
  imageUrl: 'https://media.rawiaudio.com/fr/001-un/image-16x9.webp',
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

test('un catalogue gardé avant les thèmes est complété par une liste vide', () => {
  const storage = memoryStorage()
  const { themes: _absent, ...old } = fiche
  storage.setItem('rawi:catalog:fr', JSON.stringify([old]))

  assert.deepEqual(createLocalCatalogCache(storage).getList('fr')?.[0]?.themes, [])
})

test('un catalogue gardé avant les illustrations est complété par imageUrl null', () => {
  const storage = memoryStorage()
  const { imageUrl: _absent, ...old } = fiche
  storage.setItem('rawi:catalog:fr', JSON.stringify([old]))
  storage.setItem('rawi:episode:fr-001', JSON.stringify(old))

  const cache = createLocalCatalogCache(storage)
  assert.equal(cache.getList('fr')?.[0]?.imageUrl, null)
  assert.equal(cache.getEpisode('fr-001')?.imageUrl, null)
})
