import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampPosition, isUrlUsable, resumePosition } from './playback.ts'

const now = new Date('2026-10-26T12:00:00Z')
const expiringIn = (ms: number) => ({ url: 'https://r2.example/a.mp3', expiresAt: new Date(now.getTime() + ms) })

test("une URL n'est utilisable qu'avec plus d'une minute de marge", () => {
  assert.equal(isUrlUsable(expiringIn(30 * 60_000), now), true)
  assert.equal(isUrlUsable(expiringIn(60_001), now), true)
  assert.equal(isUrlUsable(expiringIn(60_000), now), false)
  assert.equal(isUrlUsable(expiringIn(-1), now), false)
})

test('reprise : position enregistrée, sauf au tout début ou à la fin', () => {
  assert.equal(resumePosition(120, 392), 120)
  assert.equal(resumePosition(null, 392), 0)
  assert.equal(resumePosition(3, 392), 0)
  assert.equal(resumePosition(389, 392), 0) // épisode fini : on recommence
  assert.equal(resumePosition(Number.NaN, 392), 0)
})

test('une position reste dans les bornes', () => {
  assert.equal(clampPosition(-10, 392), 0)
  assert.equal(clampPosition(400, 392), 392)
  assert.equal(clampPosition(42, 392), 42)
})
