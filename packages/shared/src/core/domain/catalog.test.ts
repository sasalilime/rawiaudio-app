import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arrangeCatalog, findSeries, nextPart, type CatalogItem } from './catalog.ts'
import type { EpisodeSummary, ThemeRef } from './episode.ts'

const coran: ThemeRef = { id: 'fr-histoires-du-coran', title: 'Histoires du Coran', position: 1 }
const prophetes: ThemeRef = { id: 'fr-prophetes', title: 'Les prophètes', position: 2 }

function episode(number: number, themes: ThemeRef[], part?: number): EpisodeSummary {
  return {
    id: `fr-${String(number).padStart(3, '0')}`,
    number,
    slug: `e${number}`,
    title: `Épisode ${number}`,
    reference: 'Réf',
    durationSeconds: 300,
    publishedAt: new Date(Date.UTC(2026, 9, number)),
    series: part ? { id: 'fr-moussa', title: 'Moussa et Pharaon', part } : null,
    themes,
    imageUrl: null,
  }
}

const label = (item: CatalogItem) => (item.kind === 'episode' ? item.episode.id : `série ${item.series.id}`)

test('une section par thème dans l’ordre des thèmes, « sans thème » en dernier', () => {
  // Du plus récent au plus ancien, comme l'API ; le premier thème rencontré est le n° 2.
  const catalog = arrangeCatalog([episode(4, [prophetes, coran]), episode(3, []), episode(2, [coran]), episode(1, [coran])])

  assert.equal(catalog.latest?.id, 'fr-004')
  assert.deepEqual(
    catalog.sections.map((s) => [s.theme?.id ?? null, s.items.map(label)]),
    [
      ['fr-histoires-du-coran', ['fr-004', 'fr-002', 'fr-001']],
      ['fr-prophetes', ['fr-004']],
      [null, ['fr-003']],
    ],
  )
})

test('une série est une seule entrée, à la place de sa dernière partie, dans les thèmes de toutes ses parties', () => {
  // Parties 3 et 1 publiées (la 2 pas encore) ; la partie 1 seule est dans « Les prophètes ».
  const catalog = arrangeCatalog([episode(9, [coran], 3), episode(8, [coran]), episode(7, [coran, prophetes], 1)])

  assert.deepEqual(
    catalog.sections.map((s) => [s.theme?.id, s.items.map(label)]),
    [
      ['fr-histoires-du-coran', ['série fr-moussa', 'fr-008']],
      ['fr-prophetes', ['série fr-moussa']],
    ],
  )
  const series = catalog.sections[0]?.items[0]
  assert.ok(series?.kind === 'series')
  assert.deepEqual(series.series.parts.map((p) => p.id), ['fr-007', 'fr-009'])
  assert.equal(series.series.durationSeconds, 600)
})

test('partie suivante : la prochaine partie publiée, sinon rien', () => {
  const episodes = [episode(9, [], 3), episode(8, []), episode(7, [], 1)]

  assert.equal(nextPart(episodes, episode(7, [], 1))?.id, 'fr-009') // la partie 2 n'est pas encore publiée
  assert.equal(nextPart(episodes, episode(9, [], 3)), null)
  assert.equal(nextPart(episodes, episode(8, [])), null)
  assert.equal(findSeries(episodes, 'fr-inconnue'), null)
})

test('catalogue vide', () => {
  assert.deepEqual(arrangeCatalog([]), { episodes: [], latest: null, sections: [] })
})
