// Fait respecter la règle de dépendance (ADR-0004) dans la PWA : ui et infra ne se connaissent pas,
// et ne prennent du code partagé que le cœur (plus son ui React pour ui) ; seul main.tsx assemble http, storage et le reste.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const SRC = import.meta.dirname

// Même lecture des imports que packages/shared/src/architecture.test.ts (recopiée : un test n'en importe pas un autre).
const IMPORT = /^\s*(?:import|export)\s(?:[^'"]*\sfrom\s)?['"]([^'"]+)['"]/gm
const importsIn = (source: string) => [...source.matchAll(IMPORT)].map((match) => match[1] ?? '')
const CORE = '@rawiaudio/shared/core/'

// Pour chaque couche : les dossiers de src/ qu'elle peut importer, et les paquets npm (préfixes) autorisés.
const RULES: Record<string, { folders: string[]; packages: string[] }> = {
  infra: { folders: ['infra'], packages: [CORE] },
  ui: { folders: ['ui'], packages: [CORE, '@rawiaudio/shared/ui/', 'react', 'react-dom'] },
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
          : rule.packages.some((prefix) => specifier === prefix || specifier.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))
        if (!ok) found.push(`${relative(SRC, path)} importe « ${specifier} »`)
      }
    }
  }
  return found
}

test('chaque couche de la PWA respecte la règle de dépendance', () => {
  assert.deepEqual(violations(), [])
})
