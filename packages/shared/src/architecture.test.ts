// Fait respecter la règle de dépendance (ADR-0004) dans le code partagé entre la PWA et l'app mobile :
// core ne dépend de rien d'extérieur ; http et storage n'utilisent que core ; ui y ajoute React, et rien d'autre.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const SRC = import.meta.dirname

// Pour chaque couche : les dossiers de src/ qu'elle peut importer, et les paquets npm autorisés.
const RULES: Record<string, { folders: string[]; packages: string[] }> = {
  core: { folders: ['core'], packages: [] },
  http: { folders: ['core', 'http'], packages: [] },
  storage: { folders: ['core', 'storage'], packages: [] },
  ui: { folders: ['core', 'ui'], packages: ['react'] },
}

// import … from '…', export … from '…', import '…' : suffit pour du code écrit à la main, sans import dynamique.
const IMPORT = /^\s*(?:import|export)\s(?:[^'"]*\sfrom\s)?['"]([^'"]+)['"]/gm

function importsIn(source: string): string[] {
  return [...source.matchAll(IMPORT)].map((match) => match[1] ?? '')
}

function violations(): string[] {
  const found: string[] = []
  for (const [layer, rule] of Object.entries(RULES)) {
    const files = readdirSync(join(SRC, layer), { recursive: true, encoding: 'utf8' }).filter(
      (file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'),
    )
    for (const file of files) {
      const path = join(SRC, layer, file)
      for (const specifier of importsIn(readFileSync(path, 'utf8'))) {
        const ok = specifier.startsWith('.')
          ? rule.folders.includes(relative(SRC, resolve(dirname(path), specifier)).split(/[\\/]/)[0] ?? '')
          : rule.packages.includes(specifier)
        if (!ok) found.push(`${relative(SRC, path)} importe « ${specifier} »`)
      }
    }
  }
  return found
}

test('chaque couche du code partagé respecte la règle de dépendance', () => {
  assert.deepEqual(violations(), [])
})

test('la lecture des imports reconnaît toutes les formes écrites dans le projet', () => {
  const source = [
    "import { a } from './a.ts'",
    "import type { B } from '../b.ts'",
    'export { c } from "./c.ts"',
    "import './styles.css'",
    'import {',
    '  d,',
    "} from 'react'",
  ].join('\n')
  assert.deepEqual(importsIn(source), ['./a.ts', '../b.ts', './c.ts', './styles.css', 'react'])
})
