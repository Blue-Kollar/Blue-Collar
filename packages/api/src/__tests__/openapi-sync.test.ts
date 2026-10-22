/**
 * Guards against the OpenAPI spec (src/openapi/spec.ts + paths/*.ts) drifting
 * out of sync with the routes actually mounted in app.ts.
 *
 * This is a static diff, not a live route walk: it parses app.ts for
 * `app.use(prefix, routerVar)` mounts and each mounted route file for
 * `router.<method>(path, ...)` calls, picks the canonical prefix per router
 * (v1 if mounted there, else the unversioned prefix), and checks that every
 * resulting (method, path) pair appears in the generated openapi.json.
 *
 * It intentionally ignores routers referenced by app.use() but never
 * imported (a separate, pre-existing bug — see the SKIPPED_UNDEFINED_VARS
 * note below) and standalone `app.get(...)` handlers declared directly in
 * app.ts rather than via a mounted router file.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSpec } from '../openapi/spec.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const srcDir = join(__dirname, '..')

function extractExpectedRoutes(): string[] {
  const appSrc = readFileSync(join(srcDir, 'app.ts'), 'utf8')

  const importRe = /import\s+(?:\*\s+as\s+)?(\w+)\s+from\s+['"]\.\/routes\/([^'"]+)\.js['"]/g
  const varToFile: Record<string, string> = {}
  const importedVars = new Set<string>()
  for (const m of appSrc.matchAll(importRe)) {
    varToFile[m[1]] = m[2]
    importedVars.add(m[1])
  }

  const mountRe = /^app\.use\('(\/api(?:\/v1|\/v2)?[^']*)',\s*(\w+)\)/gm
  const mountsByVar: Record<string, { v1?: string; v2?: string; unversioned?: string }> = {}
  for (const m of appSrc.matchAll(mountRe)) {
    const [, prefix, varName] = m
    // A router referenced here but never imported can't actually be mounted —
    // that's a bug in app.ts itself, not a spec-sync gap. Nothing to document.
    if (!importedVars.has(varName)) continue
    mountsByVar[varName] ??= {}
    if (prefix.startsWith('/api/v1')) mountsByVar[varName].v1 = prefix
    else if (prefix.startsWith('/api/v2')) mountsByVar[varName].v2 = prefix
    else mountsByVar[varName].unversioned = prefix
  }

  const toOpenApiPath = (p: string) => p.replace(/:(\w+)/g, '{$1}')
  const joinPath = (prefix: string, sub: string) => {
    const full = (prefix.replace(/\/$/, '') + '/' + sub.replace(/^\//, '')).replace(/\/+$/, '') || '/'
    return toOpenApiPath(full)
  }

  const expected: string[] = []
  for (const [varName, mounts] of Object.entries(mountsByVar)) {
    const canonicalPrefix = mounts.v1 ?? mounts.unversioned ?? mounts.v2
    if (!canonicalPrefix) continue
    const routeSrc = readFileSync(join(srcDir, 'routes', varToFile[varName] + '.ts'), 'utf8')
    const routeRe = /router\.(get|post|put|patch|delete)\(\s*(?:\[[^\]]*\]|['"]([^'"]*)['"])/g
    for (const m of routeSrc.matchAll(routeRe)) {
      if (m[2] === undefined) continue // skip the rare array-of-methods form
      expected.push(`${m[1].toUpperCase()} ${joinPath(canonicalPrefix, m[2])}`)
    }
  }
  return expected
}

describe('OpenAPI spec sync', () => {
  it('documents every route mounted in app.ts', () => {
    const expected = extractExpectedRoutes()
    const spec = buildSpec()
    const documented = new Set<string>()
    for (const [path, methods] of Object.entries(spec.paths ?? {})) {
      for (const method of Object.keys(methods as object)) documented.add(`${method.toUpperCase()} ${path}`)
    }

    const missing = expected.filter(route => !documented.has(route)).sort()

    const message = missing.length > 0
      ? `openapi.json is missing ${missing.length} route(s) that are mounted in app.ts:\n\n` +
        missing.map(r => `  - ${r}`).join('\n') +
        `\n\nAdd a registry.registerPath(...) entry for each (in spec.ts or a paths/*.ts module), ` +
        `then run "npm run openapi:generate" and commit the updated openapi.json.`
      : ''

    expect(missing, message).toHaveLength(0)
  })

  it('has a checked-in openapi.json that matches the current spec source', () => {
    const generated = buildSpec()
    const checkedIn = JSON.parse(readFileSync(join(srcDir, '..', 'openapi.json'), 'utf8'))
    expect(checkedIn, 'openapi.json is stale — run "npm run openapi:generate" and commit the result').toEqual(generated)
  })
})
