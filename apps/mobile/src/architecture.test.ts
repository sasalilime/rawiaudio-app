// Fait respecter la règle de dépendance (ADR-0004) dans l'app mobile : ui et infra ne se connaissent pas,
// et ne prennent du code partagé que le cœur (plus son ui React pour ui) ; seul main.ts assemble http, storage et le reste.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const SRC = import.meta.dirname

// Même lecture des imports que packages/shared/src/architecture.test.ts (recopiée : un test n'en importe pas un autre).
const IMPORT = /^\s*(?:import|export)\s(?:[^'"]*\sfrom\s)?['"]([^'"]+)['"]/gm
const importsIn = (source: string) => [...source.matchAll(IMPORT)].map((match) => match[1] ?? '')
const CORE = '@rawiaudio/shared/core/'
const SHARED_UI = '@rawiaudio/shared/ui/'
const UI_PACKAGES = [CORE, SHARED_UI, 'react', 'react-native', 'react-native-safe-area-context', 'expo-router', 'expo-network']

// Pour chaque couche : les dossiers de src/ qu'elle peut importer, et les paquets npm (préfixes) autorisés.
const RULES: Record<string, { folders: string[]; packages: string[] }> = {
  infra: { folders: ['infra'], packages: [CORE, 'expo-audio', 'expo-file-system', 'expo-secure-store'] },
  ui: { folders: ['ui'], packages: UI_PACKAGES },
  // Les écrans d'expo-router. main.ts : pour _layout.tsx seulement, qui fournit les cas d'usage à tous les écrans.
  app: { folders: ['app', 'ui', 'main.ts'], packages: [...UI_PACKAGES, 'expo-status-bar', 'expo-font'] },
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

test("chaque couche de l'app mobile respecte la règle de dépendance", () => {
  assert.deepEqual(violations(), [])
})
