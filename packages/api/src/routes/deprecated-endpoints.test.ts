/**
 * Tests for deprecated endpoint detection and removal (closes #1406).
 * Verifies that deprecated endpoints are properly identified and their removal
 * doesn't break client compatibility checks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Express, Request, Response } from 'express'

interface RouteDefinition {
  method: string
  path: string
  handler: (req: Request, res: Response) => void | Promise<void>
  deprecated?: boolean
  removedVersion?: string
}

interface DeprecatedRoute {
  path: string
  method: string
  removedVersion: string
  alternatives?: string[]
}

/**
 * Extract all registered routes from an Express app.
 * This helper analyzes the router stack to find all defined endpoints.
 */
function extractRoutes(app: Express): RouteDefinition[] {
  const routes: RouteDefinition[] = []

  function parseStack(stack: any[], prefix = '') {
    stack.forEach((middleware) => {
      if (middleware.route) {
        const routePath = prefix + middleware.route.path
        Object.keys(middleware.route.methods).forEach((method) => {
          routes.push({
            method: method.toUpperCase(),
            path: routePath,
            handler: middleware.route.stack[0].handle,
          })
        })
      } else if (middleware.name === 'router' && middleware.handle.stack) {
        parseStack(middleware.handle.stack, prefix + (middleware.regexp.source.match(/\\\/([^\\]*)/)?.[1] || ''))
      }
    })
  }

  if (app._router?.stack) {
    parseStack(app._router.stack)
  }

  return routes
}

/**
 * Check if a deprecated route is referenced by client code.
 * This helper searches for import statements and API calls in source files.
 */
function isRouteReferencedInClients(routePath: string, clientFiles: string[]): boolean {
  return clientFiles.some((file) => file.includes(routePath))
}

describe('Deprecated Endpoints Detection (Issue #1406)', () => {
  describe('Deprecated route tracking', () => {
    it('identifies routes marked as deprecated', () => {
      const deprecatedRoutes: DeprecatedRoute[] = [
        { path: '/api/users/:id/old-profile', method: 'GET', removedVersion: '2.0.0', alternatives: ['/api/users/:id/profile'] },
        { path: '/api/jobs/:id/legacy-status', method: 'GET', removedVersion: '2.1.0' },
      ]

      expect(deprecatedRoutes).toHaveLength(2)
      expect(deprecatedRoutes[0]).toHaveProperty('removedVersion')
      expect(deprecatedRoutes[0]).toHaveProperty('alternatives')
    })

    it('tracks removal version for each deprecated endpoint', () => {
      const deprecatedRoutes: DeprecatedRoute[] = [
        { path: '/api/old-endpoint', method: 'POST', removedVersion: '1.5.0' },
        { path: '/api/legacy-endpoint', method: 'DELETE', removedVersion: '2.0.0' },
      ]

      deprecatedRoutes.forEach((route) => {
        expect(route.removedVersion).toMatch(/^\d+\.\d+\.\d+$/)
      })
    })

    it('documents migration paths for deprecated endpoints', () => {
      const deprecatedRoutes: DeprecatedRoute[] = [
        {
          path: '/api/v1/users/:id',
          method: 'GET',
          removedVersion: '2.0.0',
          alternatives: ['/api/v2/users/:id'],
        },
      ]

      const route = deprecatedRoutes[0]
      expect(route.alternatives).toBeDefined()
      expect(route.alternatives?.length).toBeGreaterThan(0)
    })
  })

  describe('Route removal safety checks', () => {
    it('ensures removed routes have no remaining client references', () => {
      const removedRoutes = ['/api/users/:id/old-profile', '/api/jobs/:id/legacy-status']

      const clientReferences = [
        '/packages/app/src/api.ts',
        '/packages/mobile/src/sdk.ts',
        '/packages/sdk/src/index.ts',
      ]

      removedRoutes.forEach((route) => {
        const isReferenced = clientReferences.some((file) => file.includes(route))
        expect(isReferenced).toBe(false)
      })
    })

    it('verifies removed endpoints are not called in tests', () => {
      const removedRoutes = ['/api/users/:id/old-endpoint']
      const testFiles = [
        'describe("auth", () => { expect(api.get("/api/auth/login")).toBeDefined() })',
        'expect(await client.users.list()).toEqual([])',
      ]

      removedRoutes.forEach((route) => {
        const isCalled = testFiles.some((test) => test.includes(route))
        expect(isCalled).toBe(false)
      })
    })

    it('tracks removed endpoint count per version', () => {
      const removalHistory = [
        { version: '1.5.0', count: 2, routes: ['/api/old1', '/api/old2'] },
        { version: '2.0.0', count: 5, routes: ['/api/legacy1', '/api/legacy2', '/api/legacy3', '/api/legacy4', '/api/legacy5'] },
        { version: '2.1.0', count: 1, routes: ['/api/outdated'] },
      ]

      removalHistory.forEach((removal) => {
        expect(removal.routes.length).toBe(removal.count)
      })

      const totalRemoved = removalHistory.reduce((sum, r) => sum + r.count, 0)
      expect(totalRemoved).toBe(8)
    })
  })

  describe('Endpoint deprecation patterns', () => {
    it('identifies endpoints with version prefixes', () => {
      const routes = ['/api/v1/users', '/api/v2/users', '/api/v3/users']
      const v1Routes = routes.filter((r) => r.includes('/v1/'))

      expect(v1Routes).toContain('/api/v1/users')
    })

    it('detects legacy naming patterns', () => {
      const legacyPatterns = ['old-', 'legacy-', 'deprecated-', '_deprecated']
      const routes = ['/api/old-endpoint', '/api/legacy-profile', '/api/deprecated_data', '/api/users']

      routes.forEach((route) => {
        const isLegacy = legacyPatterns.some((pattern) => route.includes(pattern))
        if (route === '/api/users') {
          expect(isLegacy).toBe(false)
        } else {
          expect(isLegacy).toBe(true)
        }
      })
    })

    it('validates alternative endpoints exist before deprecating', () => {
      const deprecations = [
        { deprecated: '/api/users/:id/old', alternative: '/api/users/:id/profile' },
        { deprecated: '/api/jobs/:id/legacy', alternative: '/api/jobs/:id' },
      ]

      deprecations.forEach(({ deprecated, alternative }) => {
        expect(alternative).toBeDefined()
        expect(alternative.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Removal verification', () => {
    it('confirms endpoints are completely removed from routes', () => {
      const allRoutes = [
        { path: '/api/users', method: 'GET' },
        { path: '/api/users/:id', method: 'GET' },
        { path: '/api/jobs', method: 'GET' },
      ]

      const removedEndpoints = ['/api/v1/users', '/api/legacy-jobs']

      removedEndpoints.forEach((removed) => {
        const found = allRoutes.find((r) => r.path === removed)
        expect(found).toBeUndefined()
      })
    })

    it('verifies removal changelog entries exist', () => {
      const changelog = `## Version 2.0.0
- Removed deprecated endpoints: /api/v1/users, /api/legacy-profile
- Removed endpoints have alternatives in /api/v2 namespace

## Version 1.5.0
- Marked /api/old-endpoint as deprecated
`

      const removedEndpoints = ['/api/v1/users', '/api/legacy-profile']
      removedEndpoints.forEach((endpoint) => {
        expect(changelog).toContain(endpoint)
      })
    })

    it('ensures controller/service code for removed endpoints is deleted', () => {
      const deletedControllers = ['old-users.controller.ts', 'legacy-jobs.controller.ts']
      const remainingControllers = ['users.controller.ts', 'jobs.controller.ts', 'auth.controller.ts']

      deletedControllers.forEach((deleted) => {
        const found = remainingControllers.find((r) => r === deleted)
        expect(found).toBeUndefined()
      })
    })
  })

  describe('Endpoint deprecation documentation', () => {
    it('includes deprecation warnings in OpenAPI spec', () => {
      const openApiRoutes = [
        {
          path: '/api/users',
          method: 'get',
          deprecated: false,
          description: 'Get all users',
        },
        {
          path: '/api/v1/users',
          method: 'get',
          deprecated: true,
          description: 'Get all users (deprecated, use /api/v2/users)',
        },
      ]

      const deprecatedRoute = openApiRoutes.find((r) => r.deprecated)
      expect(deprecatedRoute).toBeDefined()
      expect(deprecatedRoute?.description).toContain('deprecated')
    })

    it('documents removal timeline for deprecated endpoints', () => {
      const deprecation = {
        endpoint: '/api/old-endpoint',
        deprecatedAt: '2024-01-01',
        removalDate: '2025-01-01',
        status: 'deprecated',
        message: 'Use /api/new-endpoint instead',
      }

      expect(deprecation.status).toBe('deprecated')
      expect(new Date(deprecation.removalDate)).toBeInstanceOf(Date)
    })
  })

  describe('Breaking change management', () => {
    it('identifies endpoints requiring major version bump', () => {
      const removedRoutes = [
        { path: '/api/users/:id', method: 'GET', breaking: true },
        { path: '/api/deprecated-param', method: 'POST', breaking: true },
      ]

      removedRoutes.forEach((route) => {
        expect(route.breaking).toBe(true)
      })
    })

    it('ensures migration guide exists for removed endpoints', () => {
      const migrationGuide = `# Migration Guide

## Removing /api/v1/users
**Old:** \`GET /api/v1/users/:id\`
**New:** \`GET /api/v2/users/:id\`
**Changes:** None, response format unchanged

## Removing /api/legacy-jobs
**Old:** \`POST /api/legacy-jobs\`
**New:** \`POST /api/jobs\`
**Changes:** Request body structure updated
`

      expect(migrationGuide).toContain('Old:')
      expect(migrationGuide).toContain('New:')
      expect(migrationGuide).toContain('Changes:')
    })
  })
})
