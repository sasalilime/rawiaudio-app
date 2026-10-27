import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createListeningHistory } from './listeningHistory.ts'

test("relit l'historique, ajoute un épisode une seule fois et l'enregistre", () => {
  const saves: string[][] = []
  const history = createListeningHistory({ load: () => ['fr-001'], save: (ids) => saves.push(ids) })
  let notified = 0
  history.subscribe(() => notified++)
  const before = history.getSnapshot()

  history.markHeard('fr-002')
  history.markHeard('fr-002')

  assert.deepEqual([...history.getSnapshot()], ['fr-001', 'fr-002'])
  assert.deepEqual(saves, [['fr-001', 'fr-002']])
  assert.equal(notified, 1)
  assert.notEqual(history.getSnapshot(), before) // nouvel ensemble : React voit le changement
})
