import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { EpisodeSummary } from './episode.ts'
import { isHeard, pickRandomEpisode } from './listening.ts'

function episode(number: number, part?: number): EpisodeSummary {
  return {
    id: `fr-${String(number).padStart(3, '0')}`,
    number,
    slug: `e${number}`,
    title: `Épisode ${number}`,
    reference: 'Réf',
    durationSeconds: 300,
    publishedAt: new Date(Date.UTC(2026, 9, number)),
    series: part ? { id: 'fr-moussa', title: 'Moussa', part } : null,
    themes: [],
    imageUrl: null,
  }
}

// Épisodes 1 et 2 indépendants ; série en trois parties (3, 4, 5), du plus récent au plus ancien comme l'API.
const catalog = [episode(5, 3), episode(4, 2), episode(3, 1), episode(2), episode(1)]
const everything = () => true
const ids = (heard: string[]) => new Set(heard)

// Tous les résultats possibles d'un tirage, en faisant varier le hasard.
function possible(heard: ReadonlySet<string>, isAvailable: (e: EpisodeSummary) => boolean = everything) {
  const found = new Set<string>()
  for (let i = 0; i < 100; i++) {
    const pick = pickRandomEpisode(catalog, heard, isAvailable, () => i / 100)
    if (pick) found.add(pick.id)
  }
  return [...found].sort()
}

test('entendu au-delà de 95 % de la durée', () => {
  assert.equal(isHeard(284, 300), false)
  assert.equal(isHeard(285, 300), true)
  assert.equal(isHeard(10, 0), false)
})

test("rien d'entendu : un épisode indépendant, ou la série par sa partie 1", () => {
  assert.deepEqual(possible(ids([])), ['fr-001', 'fr-002', 'fr-003'])
})

test('série commencée : seulement sa prochaine partie non entendue, jamais une partie plus loin', () => {
  assert.deepEqual(possible(ids(['fr-001', 'fr-003'])), ['fr-002', 'fr-004'])
})

test('tout entendu : tout le catalogue, une série toujours par sa partie 1', () => {
  assert.deepEqual(possible(ids(['fr-001', 'fr-002', 'fr-003', 'fr-004', 'fr-005'])), ['fr-001', 'fr-002', 'fr-003'])
})

test('hors ligne : seulement ce qui est téléchargé', () => {
  const downloaded = (e: EpisodeSummary) => e.id === 'fr-002' || e.id === 'fr-004'

  assert.deepEqual(possible(ids([]), downloaded), ['fr-002']) // la partie 2 attend la partie 1, non téléchargée
  assert.equal(pickRandomEpisode(catalog, ids([]), () => false, Math.random), null)
})
