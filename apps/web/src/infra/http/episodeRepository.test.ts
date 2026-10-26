import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NotFoundError, UnavailableError } from '../../core/domain/errors.ts'
import { createApi } from './apiClient.ts'
import { createHttpEpisodeRepository } from './episodeRepository.ts'

// Dépôt branché sur un faux fetch qui renvoie toujours la même réponse (ou lève l'erreur donnée).
function repositoryAnswering(response: Response | Error) {
  const fakeFetch = (async () => {
    if (response instanceof Error) throw response
    return response
  }) as typeof fetch
  return createHttpEpisodeRepository(createApi('/api', fakeFetch))
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const episodeDto = {
  id: 'fr-001',
  number: 1,
  slug: 'un',
  title: 'Un',
  reference: 'Réf 1',
  durationSeconds: 392,
  publishedAt: '2026-10-16T00:00:00Z',
  series: { id: 'fr-al-kahf', title: 'Al-Kahf' },
}

test('traduit la liste en entités', async () => {
  const episodes = await repositoryAnswering(json(200, { episodes: [{ ...episodeDto, series: null }] })).list('fr')

  assert.equal(episodes.length, 1)
  assert.ok(episodes[0]?.publishedAt instanceof Date)
  assert.equal(episodes[0]?.publishedAt.toISOString(), '2026-10-16T00:00:00.000Z')
  assert.equal(episodes[0]?.series, null)
})

test('traduit une fiche en entité', async () => {
  const episode = await repositoryAnswering(
    json(200, { ...episodeDto, summary: ['p1'], sources: [{ label: 'Saadi', url: 'https://shamela.ws/book/42' }] }),
  ).get('fr-001')

  assert.deepEqual(episode.series, { id: 'fr-al-kahf', title: 'Al-Kahf' })
  assert.deepEqual(episode.summary, ['p1'])
  assert.deepEqual(episode.sources, [{ label: 'Saadi', url: 'https://shamela.ws/book/42' }])
})

test('404 devient NotFoundError', async () => {
  await assert.rejects(repositoryAnswering(json(404, { error: 'not_found' })).get('fr-999'), NotFoundError)
})

test('500 et hors ligne deviennent UnavailableError', async () => {
  await assert.rejects(repositoryAnswering(json(500, { error: 'internal' })).list('fr'), UnavailableError)
  await assert.rejects(repositoryAnswering(new TypeError('Failed to fetch')).list('fr'), UnavailableError)
})
