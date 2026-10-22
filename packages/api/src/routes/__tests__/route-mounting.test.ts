/**
 * Route mounting guard — issue #1581.
 * Every route module in src/routes must be imported and mounted in app.ts so
 * no dead route files add surface area or test cost.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const routesDir = path.resolve(here, '..')
const appSource = readFileSync(path.resolve(routesDir, '../app.ts'), 'utf8')

const routeModules = readdirSync(routesDir)
  .filter((file) => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  .map((file) => file.replace(/\.ts$/, ''))
  .sort()

/** Maps each `./routes/<name>.js` import in app.ts to its local identifier. */
const importedRoutes = new Map<string, string>()
for (const match of appSource.matchAll(/import\s+(\w+)\s+from\s+'\.\/routes\/([\w-]+)\.js'/g)) {
  importedRoutes.set(match[2]!, match[1]!)
}

describe('route mounting', () => {
  it('finds the route modules and the app.ts imports', () => {
    expect(routeModules.length).toBeGreaterThan(0)
    expect(importedRoutes.size).toBeGreaterThan(0)
  })

  it('imports every route module from app.ts', () => {
    const unimported = routeModules.filter((name) => !importedRoutes.has(name))
    expect(unimported).toEqual([])
  })

  it('imports only route modules that exist on disk', () => {
    const missing = [...importedRoutes.keys()].filter((name) => !routeModules.includes(name))
    expect(missing).toEqual([])
  })

  it('mounts every imported route with app.use', () => {
    const appUseLines = appSource.split('\n').filter((line) => line.includes('app.use('))
    const unmounted = [...importedRoutes.entries()]
      .filter(([, identifier]) => !appUseLines.some((line) => new RegExp(`\\b${identifier}\\b`).test(line)))
      .map(([name]) => name)
    expect(unmounted).toEqual([])
  })
})
