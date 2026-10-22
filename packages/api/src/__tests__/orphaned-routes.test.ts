/**
 * Test to prevent orphaned/unmounted route files
 * Ensures all controller files have corresponding mounted routes
 * Prevents issue #932 recurrence
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

describe('Route Registration Guard', () => {
  it('should not have orphaned/unmounted route files', () => {
    const routesDir = join(import.meta.dirname, '../routes')
    const appPath = join(import.meta.dirname, '../app.ts')

    // Get all route files
    const routeFiles = readdirSync(routesDir)
      .filter(f => f.endsWith('.ts') && !f.includes('.test.'))
      .map(f => f.replace('.ts', ''))

    // Read app.ts to see which routes are mounted
    const appContent = readFileSync(appPath, 'utf-8')

    const unmountedRoutes: string[] = []

    for (const routeFile of routeFiles) {
      // Check if route is imported
      // Pattern: import xxxRoutes from './routes/xxx.js' or similar variations
      const importMatch = appContent.match(
        new RegExp(
          `import\\s+(\\w+)\\s+from\\s+['\"].*routes/${routeFile}(?:\\.js)?['"]`,
          'i'
        )
      )
      
      if (!importMatch) {
        unmountedRoutes.push(routeFile)
      } else {
        // Route is imported - check if the imported variable is used with app.use()
        const importedVarName = importMatch[1]
        const usageRegex = new RegExp(`app\\.use\\([^)]*${importedVarName}`, 'i')
        if (!usageRegex.test(appContent)) {
          unmountedRoutes.push(`${routeFile} (imported as ${importedVarName} but not mounted)`)
        }
      }
    }

    const message = unmountedRoutes.length > 0
      ? `Found unmounted/orphaned route file(s): ${unmountedRoutes.join(', ')}\n\n` +
        `Action: Either mount the route in app.ts with app.use(), or delete the route file.\n` +
        `Reference: https://github.com/Blue-Kollar/Blue-Collar/issues/932`
      : ''

    expect(unmountedRoutes).toHaveLength(0, message)
  })

  it('should not have orphaned/unmounted controller files', () => {
    const controllersDir = join(import.meta.dirname, '../controllers')
    const routesDir = join(import.meta.dirname, '../routes')

    // Get all controller files
    const controllerFiles = readdirSync(controllersDir)
      .filter(f => f.endsWith('.ts') && !f.includes('.test.'))
      .map(f => f.replace('.ts', ''))

    // Get all route files
    const routeFiles = readdirSync(routesDir)
      .filter(f => f.endsWith('.ts') && !f.includes('.test.'))
      .map(f => readFileSync(join(routesDir, f), 'utf-8'))
      .join('\n')

    const unusedControllers: string[] = []

    for (const controllerFile of controllerFiles) {
      // Skip generic/utility/sub-controllers that are re-exported via facade controllers
      const isUtilityController = [
        'audit',
        'webhooks',
        'analyticsEvents',
        'response-time',
        'admin-users.controller',
        'admin-workers.controller',
        'admin-audit.controller',
        'admin-stats.controller',
      ].includes(controllerFile)

      if (!isUtilityController) {
        // Check if controller is referenced in any route file
        const controllerRegex = new RegExp(
          `from\\s+['"]\\.*/controllers/${controllerFile}`,
          'i'
        )
        if (!controllerRegex.test(routeFiles)) {
          unusedControllers.push(controllerFile)
        }
      }
    }

    const message = unusedControllers.length > 0
      ? `Found unused controller file(s): ${unusedControllers.join(', ')}\n\n` +
        `Action: Either create a corresponding route file or delete the controller.\n` +
        `Reference: https://github.com/Blue-Kollar/Blue-Collar/issues/932`
      : ''

    expect(unusedControllers).toHaveLength(0, message)
  })
})
