import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NOTHING_REPORTED, playerEvents, type Reported } from './playerEvents.ts'

const status = (patch: Partial<{ playing: boolean; isBuffering: boolean; didJustFinish: boolean; error: string | null }> = {}) => ({
  playing: false,
  isBuffering: false,
  didJustFinish: false,
  error: null,
  ...patch,
})

/** Rejoue une suite d'états comme le ferait expo-audio, et renvoie les événements émis à chacun. */
function replay(...statuses: ReturnType<typeof status>[]): string[][] {
  let reported: Reported = NOTHING_REPORTED
  return statuses.map((s) => {
    const [events, next] = playerEvents(s, reported)
    reported = next
    return events
  })
}

test('lecture, avancée, pause', () => {
  assert.deepEqual(replay(status({ playing: true }), status({ playing: true }), status()), [['playing', 'time'], ['time'], ['paused', 'time']])
})

test('attente du réseau pendant la lecture, puis reprise', () => {
  assert.deepEqual(
    replay(status({ playing: true }), status({ playing: true, isBuffering: true }), status({ playing: true })),
    [['playing', 'time'], ['waiting', 'time'], ['playing', 'time']],
  )
})

test('fin : « ended » seul, sans « paused » ensuite', () => {
  assert.deepEqual(replay(status({ playing: true }), status({ didJustFinish: true }), status()), [['playing', 'time'], ['ended'], ['time']])
})

test('une erreur est signalée une fois, pas à chaque mise à jour', () => {
  assert.deepEqual(replay(status({ error: 'réseau' }), status({ error: 'réseau' })), [['error'], ['time']])
})
