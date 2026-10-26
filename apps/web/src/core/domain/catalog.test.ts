import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrangeCatalog } from './catalog.ts'
import type { EpisodeSummary, ThemeRef } from './episode.ts'

const coran: ThemeRef = { id: 'fr-histoires-du-coran', title: 'Histoires du Coran', position: 1 }
const prophetes: ThemeRef = { id: 'fr-prophetes', title: 'Les prophètes', position: 2 }

const episode = (number: number, themes: ThemeRef[]): EpisodeSummary => ({
  id: `fr-00${number}`,
  number,
  slug: `e${number}`,
  title: `Épisode ${number}`,
  reference: 'Réf',
  durationSeconds: 300,
  publishedAt: new Date(`2026-10-1${number}T00:00:00Z`),
  series: null,
  themes,
})

const ids = (episodes: EpisodeSummary[]) => episodes.map((e) => e.id)

test('une section par thème, dans l’ordre des thèmes, et « sans thème » en dernier', () => {
  // Du plus récent au plus ancien, comme l'API ; le premier thème rencontré est le n° 2.
  const catalog = arrangeCatalog([episode(4, [prophetes, coran]), episode(3, []), episode(2, [coran]), episode(1, [coran])])

  assert.equal(catalog.latest?.id, 'fr-004')
  assert.deepEqual(
    catalog.sections.map((s) => [s.theme?.id ?? null, ids(s.episodes)]),
    [
      ['fr-histoires-du-coran', ['fr-004', 'fr-002', 'fr-001']],
      ['fr-prophetes', ['fr-004']],
      [null, ['fr-003']],
    ],
  )
})

test('un épisode de deux thèmes apparaît dans les deux', () => {
  const catalog = arrangeCatalog([episode(1, [coran, prophetes])])

  assert.deepEqual(catalog.sections.map((s) => ids(s.episodes)), [['fr-001'], ['fr-001']])
})

test('catalogue vide', () => {
  assert.deepEqual(arrangeCatalog([]), { latest: null, sections: [] })
})
