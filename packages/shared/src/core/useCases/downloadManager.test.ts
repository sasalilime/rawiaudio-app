import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EpisodeSummary } from '../domain/episode.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'
import type { OfflineAudioStore } from '../ports/offlineAudioStore.ts'
import { createDownloadManager } from './downloadManager.ts'

const episode: EpisodeSummary = {
  id: 'fr-001',
  number: 1,
  slug: 'un',
  title: 'Un',
  reference: 'Réf 1',
  durationSeconds: 392,
  publishedAt: new Date('2026-10-16T00:00:00Z'),
  series: null,
  themes: [],
}

const episodes: EpisodeRepository = {
  list: async () => [],
  get: async () => {
    throw new Error('non utilisé')
  },
  getAudioUrl: async (id) => ({ url: `https://r2/${id}?sig=1`, expiresAt: new Date(Date.now() + 3_600_000) }),
}

function memoryStore(already: string[] = [], failSave = false) {
  const saved = new Set(already)
  const calls: string[] = []
  const store: OfflineAudioStore = {
    list: async () => [...saved],
    save: async (id, url, onProgress) => {
      calls.push(`save ${id} ${url}`)
      onProgress(0.5)
      if (failSave) throw new TypeError('Failed to fetch')
      saved.add(id)
    },
    remove: async (id) => {
      saved.delete(id)
    },
    localUrl: (id) => `/offline/${id}`,
    persist: async () => {
      calls.push('persist')
      return true
    },
  }
  return { store, calls }
}

test('relit au démarrage les épisodes déjà enregistrés', async () => {
  const manager = createDownloadManager(episodes, memoryStore(['fr-001']).store)
  assert.equal(manager.localSource('fr-001'), null)

  await manager.load()
  assert.deepEqual(manager.getSnapshot().get('fr-001'), { status: 'downloaded' })
  assert.equal(manager.localSource('fr-001'), '/offline/fr-001')
})

test("télécharge depuis une URL neuve, rangée sous l'identifiant, avec la progression", async () => {
  const { store, calls } = memoryStore()
  const manager = createDownloadManager(episodes, store)
  const seen: string[] = []
  manager.subscribe(() => seen.push(JSON.stringify(manager.getSnapshot().get('fr-001'))))

  await manager.download(episode)

  assert.deepEqual(calls, ['save fr-001 https://r2/fr-001?sig=1', 'persist'])
  assert.deepEqual(seen, [
    '{"status":"downloading","progress":null}',
    '{"status":"downloading","progress":0.5}',
    '{"status":"downloaded"}',
  ])
})

test('échec du téléchargement : état error, et pas de copie locale', async () => {
  const manager = createDownloadManager(episodes, memoryStore([], true).store)

  await manager.download(episode)
  assert.deepEqual(manager.getSnapshot().get('fr-001'), { status: 'error' })
  assert.equal(manager.localSource('fr-001'), null)
})

test('suppression : plus de copie locale', async () => {
  const manager = createDownloadManager(episodes, memoryStore(['fr-001']).store)
  await manager.load()

  await manager.remove('fr-001')
  assert.equal(manager.getSnapshot().has('fr-001'), false)
  assert.equal(manager.localSource('fr-001'), null)
})

test("chaque changement produit un nouvel instantané (React les compare par référence)", async () => {
  const manager = createDownloadManager(episodes, memoryStore().store)
  const before = manager.getSnapshot()

  await manager.download(episode)
  assert.notEqual(manager.getSnapshot(), before)
})
