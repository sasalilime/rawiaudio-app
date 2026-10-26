import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EpisodeSummary } from '../domain/episode.ts'
import { PlaybackBlockedError } from '../domain/errors.ts'
import type { AudioUrl } from '../domain/playback.ts'
import type { AudioPlayer, PlayerEvent } from '../ports/audioPlayer.ts'
import type { EpisodeRepository } from '../ports/episodeRepository.ts'
import { createPlaybackSession } from './playbackSession.ts'

const episode = (id: string): EpisodeSummary => ({
  id,
  number: Number(id.slice(3)),
  slug: id,
  title: `Titre ${id}`,
  reference: 'Réf',
  durationSeconds: 392,
  publishedAt: new Date('2026-10-16T00:00:00Z'),
  series: null,
  themes: [],
})

// Laisse s'exécuter les promesses en attente (réponse de l'API simulée).
const flush = () => new Promise((resolve) => setImmediate(resolve))

function setup(saved: Record<string, number> = {}, downloaded: string[] = []) {
  let clock = new Date('2026-10-26T12:00:00Z').getTime()
  const calls: string[] = []
  let urlCount = 0
  let position = 0
  let listener: (event: PlayerEvent) => void = () => undefined
  let playError: Error | null = null

  const episodes: EpisodeRepository = {
    list: async () => [],
    get: async () => {
      throw new Error('non utilisé')
    },
    getAudioUrl: async (id): Promise<AudioUrl> => {
      urlCount++
      return { url: `https://r2/${id}?v=${urlCount}`, expiresAt: new Date(clock + 60 * 60_000) }
    },
  }
  const player: AudioPlayer = {
    load: (src, startAt, metadata) => {
      calls.push(`load ${src} @${startAt} ${metadata.title}`)
      position = startAt
    },
    play: () => {
      calls.push('play')
      return playError ? Promise.reject(playError) : Promise.resolve()
    },
    pause: () => {
      calls.push('pause')
    },
    seekTo: (seconds) => {
      calls.push(`seek ${seconds}`)
      position = seconds
    },
    position: () => position,
    onEvent: (l) => {
      listener = l
      return () => undefined
    },
  }
  const store = new Map(Object.entries(saved))
  const saves: string[] = []
  const session = createPlaybackSession({
    episodes,
    player,
    positions: {
      get: (id) => store.get(id) ?? null,
      save: (id, seconds) => {
        saves.push(`${id} ${seconds}`)
        store.set(id, seconds)
      },
      clear: (id) => {
        store.delete(id)
      },
    },
    now: () => new Date(clock),
    describe: (e) => ({ title: e.title, artist: 'Rawi Audio', artworkUrl: '/icon.png' }),
    localSource: (id) => (downloaded.includes(id) ? `/offline/${id}` : null),
  })
  return {
    session,
    calls,
    saves,
    store,
    urlCount: () => urlCount,
    emit: (event: PlayerEvent) => listener(event),
    setPosition: (seconds: number) => {
      position = seconds
    },
    advance: (ms: number) => {
      clock += ms
    },
    failPlayWith: (error: Error) => {
      playError = error
    },
  }
}

test("URL préparée : play charge et lance le son sans rien attendre (geste de l'utilisateur sur iOS)", async () => {
  const t = setup()
  t.session.prepare(episode('fr-001'))
  await flush()

  t.session.play(episode('fr-001'))

  // Vérifié aussitôt, sans await : tout s'est fait pendant l'appel.
  assert.deepEqual(t.calls, ['load https://r2/fr-001?v=1 @0 Titre fr-001', 'play'])
  assert.equal(t.session.getSnapshot().status, 'loading')
  t.emit('playing')
  assert.equal(t.session.getSnapshot().status, 'playing')
})

test("sans URL préparée : l'URL est demandée, puis le son lancé", async () => {
  const t = setup()

  t.session.play(episode('fr-001'))
  assert.deepEqual(t.calls, [])
  assert.equal(t.session.getSnapshot().status, 'loading')

  await flush()
  assert.deepEqual(t.calls, ['load https://r2/fr-001?v=1 @0 Titre fr-001', 'play'])
})

test('reprend à la position enregistrée', async () => {
  const t = setup({ 'fr-001': 120 })

  assert.equal(t.session.resumeAt(episode('fr-001')), 120)
  t.session.play(episode('fr-001'))
  await flush()
  assert.equal(t.calls[0], 'load https://r2/fr-001?v=1 @120 Titre fr-001')
})

test('enregistre la position à la pause, et au plus toutes les 5 s pendant la lecture', async () => {
  const t = setup()
  t.session.play(episode('fr-001'))
  await flush()
  t.emit('playing')

  for (const [ms, at] of [[1000, 10], [2000, 12], [5000, 17]] as const) {
    t.advance(ms)
    t.setPosition(at)
    t.emit('time')
  }
  t.setPosition(18)
  t.emit('paused')

  assert.deepEqual(t.saves, ['fr-001 10', 'fr-001 17', 'fr-001 18'])
  assert.equal(t.session.getSnapshot().status, 'paused')
})

test('épisode fini : la position enregistrée est effacée', async () => {
  const t = setup({ 'fr-001': 120 })
  t.session.play(episode('fr-001'))
  await flush()

  t.emit('ended')
  assert.equal(t.store.has('fr-001'), false)
  assert.equal(t.session.getSnapshot().status, 'ended')
})

test('URL expirée pendant la pause : nouvelle URL, et reprise au même endroit', async () => {
  const t = setup()
  t.session.play(episode('fr-001'))
  await flush()
  t.setPosition(200)
  t.emit('paused')

  t.advance(2 * 60 * 60_000) // deux heures de pause
  t.calls.length = 0
  t.session.toggle()
  await flush()

  assert.equal(t.urlCount(), 2)
  assert.deepEqual(t.calls, ['load https://r2/fr-001?v=2 @200 Titre fr-001', 'play'])
})

test("erreur du lecteur : une seule nouvelle tentative si l'URL a expiré, sinon statut error", async () => {
  const t = setup()
  t.session.play(episode('fr-001'))
  await flush()

  t.emit('error') // URL encore valide : vraie erreur
  assert.equal(t.session.getSnapshot().status, 'error')

  const u = setup()
  u.session.play(episode('fr-001'))
  await flush()
  u.setPosition(42)
  u.advance(2 * 60 * 60_000)
  u.emit('error') // URL expirée : on en redemande une
  await flush()
  assert.equal(u.urlCount(), 2)
  assert.equal(u.calls.at(-2), 'load https://r2/fr-001?v=2 @42 Titre fr-001')
})

test('lecture refusée par le navigateur : statut blocked, un nouvel appui relance', async () => {
  const t = setup()
  t.failPlayWith(new PlaybackBlockedError('geste requis'))
  t.session.play(episode('fr-001'))
  await flush()
  assert.equal(t.session.getSnapshot().status, 'blocked')

  t.calls.length = 0
  t.session.toggle()
  assert.deepEqual(t.calls, ['play'])
})

test("changer d'épisode enregistre la position du précédent", async () => {
  const t = setup()
  t.session.play(episode('fr-001'))
  await flush()
  t.setPosition(90)

  t.session.play(episode('fr-002'))
  await flush()

  assert.ok(t.saves.includes('fr-001 90'))
  assert.equal(t.session.getSnapshot().episode?.id, 'fr-002')
  assert.equal(t.calls.at(-2), 'load https://r2/fr-002?v=2 @0 Titre fr-002')
})

test("pause pendant l'attente de l'URL : le son ne part pas", async () => {
  const t = setup()
  t.session.play(episode('fr-001'))
  t.session.toggle()
  await flush()

  assert.deepEqual(t.calls, [])
  assert.equal(t.session.getSnapshot().status, 'paused')
})

test('les sauts restent dans les bornes de l’épisode', async () => {
  const t = setup()
  t.session.play(episode('fr-001'))
  await flush()
  t.setPosition(10)

  t.session.seekBy(-15)
  t.session.seekBy(1000)
  assert.deepEqual(t.calls.slice(-2), ['seek 0', 'seek 392'])
})

test("épisode téléchargé : lu depuis la copie locale, sans demander d'URL à l'API", async () => {
  const t = setup({}, ['fr-001'])
  t.session.prepare(episode('fr-001'))

  t.session.play(episode('fr-001'))

  assert.deepEqual(t.calls, ['load /offline/fr-001 @0 Titre fr-001', 'play'])
  t.advance(24 * 60 * 60_000) // une copie locale n'expire jamais
  t.emit('paused')
  t.calls.length = 0
  t.session.toggle()
  assert.deepEqual(t.calls, ['play'])
  assert.equal(t.urlCount(), 0)
})
