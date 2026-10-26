import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Episode, EpisodeSummary } from '../domain/episode.ts'
import { NotFoundError } from '../domain/errors.ts'
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
}

// Faux dépôt : note les appels et renvoie ce qu'on lui donne.
function fakeRepository(get: () => Promise<Episode>) {
  const calls: string[] = []
  const repository: EpisodeRepository = {
    list: async (lang) => {
      calls.push(`list ${lang}`)
      return [summary]
    },
    get: async (id) => {
      calls.push(`get ${id}`)
      return get()
    },
  }
  return { repository, calls }
}

test('listCatalog lit les épisodes de la langue demandée', async () => {
  const { repository, calls } = fakeRepository(async () => ({ ...summary, summary: [], sources: [] }))

  assert.deepEqual(await createListCatalog(repository)('fr'), [summary])
  assert.deepEqual(calls, ['list fr'])
})

test('getEpisode laisse passer NotFoundError, que la page sait afficher', async () => {
  const { repository, calls } = fakeRepository(async () => {
    throw new NotFoundError('fr-999')
  })

  await assert.rejects(createGetEpisode(repository)('fr-999'), NotFoundError)
  assert.deepEqual(calls, ['get fr-999'])
})
