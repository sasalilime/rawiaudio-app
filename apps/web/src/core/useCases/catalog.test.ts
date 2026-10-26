import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Episode, EpisodeSummary } from '../domain/episode.ts'
import { NotFoundError, UnavailableError } from '../domain/errors.ts'
import type { CatalogCache } from '../ports/catalogCache.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'
import { createGetEpisode } from './getEpisode.ts'
import { createListCatalog } from './listCatalog.ts'

const summary: EpisodeSummary = {
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
const fiche: Episode = { ...summary, summary: ['p'], sources: [] }

// Faux dépôt : répond ce qu'on lui donne, ou lève l'erreur donnée.
function repository(answer: () => Promise<EpisodeSummary[] | Episode>): EpisodeRepository {
  return {
    list: async () => (await answer()) as EpisodeSummary[],
    get: async () => (await answer()) as Episode,
    getAudioUrl: async () => {
      throw new Error('non utilisé')
    },
  }
}

function memoryCache(): CatalogCache & { lists: Map<string, EpisodeSummary[]>; episodes: Map<string, Episode> } {
  const lists = new Map<string, EpisodeSummary[]>()
  const episodes = new Map<string, Episode>()
  return {
    lists,
    episodes,
    getList: (lang) => lists.get(lang) ?? null,
    saveList: (lang, list) => {
      lists.set(lang, list)
    },
    getEpisode: (id) => episodes.get(id) ?? null,
    saveEpisode: (episode) => {
      episodes.set(episode.id, episode)
    },
  }
}

test('en ligne : la liste vient de l’API, est gardée pour plus tard, et revient rangée', async () => {
  const cache = memoryCache()

  const catalog = await createListCatalog(repository(async () => [summary]), cache)('fr')
  assert.deepEqual(catalog, {
    episodes: [summary],
    latest: summary,
    sections: [{ theme: null, items: [{ kind: 'episode', episode: summary }] }],
  })
  assert.deepEqual(cache.lists.get('fr'), [summary])
})

test('API injoignable : la dernière liste connue', async () => {
  const cache = memoryCache()
  cache.saveList('fr', [summary])
  const offline = repository(async () => {
    throw new UnavailableError('hors ligne')
  })

  assert.equal((await createListCatalog(offline, cache)('fr')).latest, summary)
})

test('API injoignable et rien de gardé : l’erreur remonte', async () => {
  const offline = repository(async () => {
    throw new UnavailableError('hors ligne')
  })

  await assert.rejects(createListCatalog(offline, memoryCache())('fr'), UnavailableError)
})

test('fiche : gardée en ligne, relue hors ligne', async () => {
  const cache = memoryCache()
  await createGetEpisode(repository(async () => fiche), cache)('fr-001')
  const offline = repository(async () => {
    throw new UnavailableError('hors ligne')
  })

  assert.deepEqual(await createGetEpisode(offline, cache)('fr-001'), fiche)
})

test('un épisode introuvable ne se remplace pas par une ancienne fiche', async () => {
  const cache = memoryCache()
  cache.saveEpisode(fiche)
  const gone = repository(async () => {
    throw new NotFoundError('fr-001')
  })

  await assert.rejects(createGetEpisode(gone, cache)('fr-001'), NotFoundError)
})
