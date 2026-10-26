// Fait respecter la règle de dépendance (ADR-0004) : core ne dépend de rien d'extérieur,
// ui et infra ne se connaissent pas ; seul main.tsx assemble le tout.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const SRC = import.meta.dirname

// Pour chaque couche : les dossiers de src/ qu'elle a le droit d'importer, et si elle peut importer des paquets npm.
const RULES: Record<string, { allowed: string[]; packages: boolean }> = {
  core: { allowed: ['core'], packages: false },
  infra: { allowed: ['core', 'infra'], packages: false },
  ui: { allowed: ['core', 'ui'], packages: true },
}

// import … from '…', export … from '…', import '…' : suffit pour du code écrit à la main, sans import dynamique.
const IMPORT = /^\s*(?:import|export)\s(?:[^'"]*\sfrom\s)?['"]([^'"]+)['"]/gm

function importsIn(source: string): string[] {
  return [...source.matchAll(IMPORT)].map((match) => match[1] ?? '')
}

function violations(): string[] {
  const found: string[] = []
  for (const [layer, rule] of Object.entries(RULES)) {
    const files = readdirSync(join(SRC, layer), { recursive: true, encoding: 'utf8' })
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
    for (const file of files) {
      const path = join(SRC, layer, file)
      for (const specifier of importsIn(readFileSync(path, 'utf8'))) {
        const where = `${relative(SRC, path)} importe « ${specifier} »`
        if (!specifier.startsWith('.')) {
          if (!rule.packages) found.push(where)
          continue
        }
        const target = relative(SRC, resolve(dirname(path), specifier)).split(/[\\/]/)[0] ?? ''
        if (!rule.allowed.includes(target)) found.push(where)
      }
    }
  }
  return found
}

test('chaque couche respecte la règle de dépendance', () => {
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
