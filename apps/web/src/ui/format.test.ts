import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatClock, formatDuration } from './format.ts'

test('formatDuration arrondit à la minute, jamais 0', () => {
  assert.equal(formatDuration(392), '7 min')
  assert.equal(formatDuration(389), '6 min')
  assert.equal(formatDuration(10), '1 min')
})

test('formatClock', () => {
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(187.9), '3:07')
  assert.equal(formatClock(3725), '1:02:05')
  assert.equal(formatClock(Number.NaN), '0:00') // durée inconnue avant le chargement
  assert.equal(formatClock(-3), '0:00')
})
