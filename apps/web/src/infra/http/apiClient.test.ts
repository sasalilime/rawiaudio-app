import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createApi } from './apiClient.ts'

// Faux fetch : note l'URL demandée et renvoie la réponse donnée.
function fakeFetch(response: Response | Error) {
  const calls: string[] = []
  const fn = async (input: RequestInfo | URL) => {
    calls.push(String(input))
    if (response instanceof Error) throw response
    return response
  }
  return { fn: fn as typeof fetch, calls }
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

test('appelle la bonne URL et renvoie le JSON', async () => {
  const { fn, calls } = fakeFetch(json(200, { episodes: [] }))
  const api = createApi('/api', fn)

  assert.deepEqual(await api.listEpisodes('fr'), { episodes: [] })
  assert.deepEqual(calls, ['/api/episodes?lang=fr'])
})

test("encode l'identifiant dans le chemin", async () => {
  const { fn, calls } = fakeFetch(json(200, {}))
  await createApi('https://api.rawiaudio.com', fn).getAudioUrl('fr/../x')

  assert.deepEqual(calls, ['https://api.rawiaudio.com/episodes/fr%2F..%2Fx/audio'])
})

test("traduit une réponse d'erreur en ApiError avec son code", async () => {
  const { fn } = fakeFetch(json(404, { error: 'not_found' }))

  await assert.rejects(createApi('/api', fn).getEpisode('fr-999'), (err: unknown) => {
    assert.ok(err instanceof ApiError)
    assert.equal(err.status, 404)
    assert.equal(err.code, 'not_found')
    return true
  })
})

test("une erreur sans corps JSON devient le code internal", async () => {
  const { fn } = fakeFetch(new Response('Bad Gateway', { status: 502 }))

  await assert.rejects(createApi('/api', fn).getEpisode('fr-001'), { status: 502, code: 'internal' })
})

test('hors ligne : status 0 et code network', async () => {
  const { fn } = fakeFetch(new TypeError('Failed to fetch'))

  await assert.rejects(createApi('/api', fn).listEpisodes('fr'), { status: 0, code: 'network' })
})

test("une annulation n'est pas déguisée en erreur réseau", async () => {
  const controller = new AbortController()
  controller.abort()
  const { fn } = fakeFetch(new DOMException('aborted', 'AbortError'))

  await assert.rejects(createApi('/api', fn).listEpisodes('fr', controller.signal), { name: 'AbortError' })
})
