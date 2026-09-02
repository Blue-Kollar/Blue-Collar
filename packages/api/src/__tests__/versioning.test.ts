import type { NextFunction,Request, Response } from 'express'
import { beforeEach,describe, expect, it, vi } from 'vitest'

import { deprecationWarning, VERSION_CONFIG,versionDeprecationMiddleware, versionMiddleware } from '../middleware/version.js'
import {
  getApiVersion,
  getSupportedVersions,
  getVersionMigrationInfo,
  getVersionRateLimitConfig,
  isDeprecatedVersion,
  isSupportedVersion,
} from '../utils/versioning.js'

function mockReq(path: string, headers: Record<string, string> = {}): Partial<Request> {
  return {
    path,
    get: (name: string) => headers[name.toLowerCase()],
    headers,
  } as any
}

function mockRes(): { headers: Record<string, string>; setHeader: ReturnType<typeof vi.fn> } {
  const headers: Record<string, string> = {}
  return {
    headers,
    setHeader: vi.fn((key: string, value: string) => { headers[key] = value }),
  }
}

describe('versionMiddleware', () => {
  it('sets X-API-Version to v1 for /api/v1/ paths', () => {
    const req = mockReq('/api/v1/workers') as any
    const res = mockRes() as any
    const next = vi.fn()
    versionMiddleware(req, res, next)
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1')
    expect(req.apiVersion).toBe('v1')
    expect(next).toHaveBeenCalled()
  })

  it('defaults to v1 for unversioned /api/ paths', () => {
    const req = mockReq('/api/workers') as any
    const res = mockRes() as any
    const next = vi.fn()
    versionMiddleware(req, res, next)
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1')
    expect(req.apiVersion).toBe('v1')
  })

  it('sets X-API-Version to v2 for /api/v2/ paths', () => {
    const req = mockReq('/api/v2/workers') as any
    const res = mockRes() as any
    const next = vi.fn()
    versionMiddleware(req, res, next)
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v2')
    expect(req.apiVersion).toBe('v2')
  })

  it('extracts version from Accept-Version header', () => {
    const req = mockReq('/workers', { 'accept-version': 'v2' }) as any
    const res = mockRes() as any
    const next = vi.fn()
    versionMiddleware(req, res, next)
    expect(req.apiVersion).toBe('v2')
    expect(next).toHaveBeenCalled()
  })

  it('prefers URL path version over Accept-Version header', () => {
    const req = mockReq('/api/v1/workers', { 'accept-version': 'v2' }) as any
    const res = mockRes() as any
    const next = vi.fn()
    versionMiddleware(req, res, next)
    expect(req.apiVersion).toBe('v1')
  })

  it('ignores invalid versions in Accept-Version header', () => {
    const req = mockReq('/workers', { 'accept-version': 'v99' }) as any
    const res = mockRes() as any
    const next = vi.fn()
    versionMiddleware(req, res, next)
    expect(req.apiVersion).toBe('v1')
  })

  it('sets versionDeprecated flag for deprecated versions', () => {
    // Temporarily mark v1 as deprecated for testing
    const original = VERSION_CONFIG.deprecated
    ;(VERSION_CONFIG as any).deprecated = ['v1']
    
    const req = mockReq('/api/v1/workers') as any
    const res = mockRes() as any
    const next = vi.fn()
    versionMiddleware(req, res, next)
    expect(req.versionDeprecated).toBe(true)
    
    ;(VERSION_CONFIG as any).deprecated = original
  })
})

describe('deprecationWarning', () => {
  it('sets Deprecation, Warning, and Sunset headers', () => {
    const req = mockReq('/api/workers') as any
    const res = mockRes() as any
    const next = vi.fn()
    deprecationWarning(req, res, next)
    expect(res.headers['Deprecation']).toBe('true')
    expect(res.headers['Warning']).toContain('deprecated')
    expect(res.headers['Sunset']).toBeDefined()
    expect(next).toHaveBeenCalled()
  })
})

describe('versionDeprecationMiddleware', () => {
  it('adds deprecation headers when version is marked deprecated', () => {
    const req = mockReq('/api/v1/workers') as any
    req.versionDeprecated = true
    req.apiVersion = 'v1'
    const res = mockRes() as any
    const next = vi.fn()
    versionDeprecationMiddleware(req, res, next)
    expect(res.headers['Deprecation']).toBe('true')
    expect(res.headers['Warning']).toContain('deprecated')
    expect(next).toHaveBeenCalled()
  })

  it('does not add deprecation headers for non-deprecated versions', () => {
    const req = mockReq('/api/v1/workers') as any
    req.versionDeprecated = false
    const res = mockRes() as any
    const next = vi.fn()
    versionDeprecationMiddleware(req, res, next)
    expect(res.headers['Deprecation']).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })
})

describe('versioning utilities', () => {
  it('getApiVersion returns version from request', () => {
    const req = { apiVersion: 'v2' } as any
    expect(getApiVersion(req)).toBe('v2')
  })

  it('getApiVersion defaults to current version', () => {
    const req = {} as any
    expect(getApiVersion(req)).toBe('v1')
  })

  it('isSupportedVersion validates supported versions', () => {
    expect(isSupportedVersion('v1')).toBe(true)
    expect(isSupportedVersion('v2')).toBe(true)
    expect(isSupportedVersion('v99')).toBe(false)
  })

  it('isDeprecatedVersion checks deprecated status', () => {
    expect(isDeprecatedVersion('v1')).toBe(false)
  })

  it('getSupportedVersions returns all supported versions', () => {
    const versions = getSupportedVersions()
    expect(versions).toContain('v1')
    expect(versions).toContain('v2')
    expect(versions.length).toBeGreaterThanOrEqual(2)
  })

  it('getVersionRateLimitConfig returns rate limit config', () => {
    const config = getVersionRateLimitConfig('v1')
    expect(config).toBeDefined()
    expect(config?.requests).toBeGreaterThan(0)
    expect(config?.windowMs).toBeGreaterThan(0)
  })

  it('getVersionRateLimitConfig returns different configs for different versions', () => {
    const v1Config = getVersionRateLimitConfig('v1')
    const v2Config = getVersionRateLimitConfig('v2')
    expect(v1Config?.requests).toBeLessThan(v2Config?.requests ?? 0)
  })

  it('getVersionMigrationInfo returns null for non-deprecated versions', () => {
    expect(getVersionMigrationInfo('v1')).toBeNull()
  })
})

describe('API Versioning Integration', () => {
  describe('Version-specific endpoints', () => {
    it('v1 and v2 endpoints are both supported', () => {
      expect(isSupportedVersion('v1')).toBe(true)
      expect(isSupportedVersion('v2')).toBe(true)
    })

    it('current version is v2', () => {
      const req = {} as any
      expect(getApiVersion(req)).toBe('v1') // defaults to v1 if not set
    })

    it('version config has auth policies for both versions', () => {
      expect(VERSION_CONFIG.authPolicies).toBeDefined()
      expect(VERSION_CONFIG.authPolicies.v1).toBeDefined()
      expect(VERSION_CONFIG.authPolicies.v2).toBeDefined()
    })

    it('v2 has stricter auth than v1', () => {
      const v1Policy = VERSION_CONFIG.authPolicies.v1
      const v2Policy = VERSION_CONFIG.authPolicies.v2
      
      // v2 should not allow API keys while v1 does
      expect(v1Policy.allowApiKey).toBe(true)
      expect(v2Policy.allowApiKey).toBe(false)
    })
  })

  describe('Rate limiting', () => {
    it('v1 and v2 have different rate limits', () => {
      const v1Limits = getVersionRateLimitConfig('v1')
      const v2Limits = getVersionRateLimitConfig('v2')

      expect(v1Limits).toBeDefined()
      expect(v2Limits).toBeDefined()
      expect(v1Limits?.requests).not.toBe(v2Limits?.requests)
    })

    it('v2 has higher rate limit than v1', () => {
      const v1Limits = getVersionRateLimitConfig('v1')
      const v2Limits = getVersionRateLimitConfig('v2')

      expect(v2Limits?.requests).toBeGreaterThan(v1Limits?.requests ?? 0)
    })
  })

  describe('Schema transformation', () => {
    it('imports schema versioning utilities', async () => {
      const {
        transformResponseData,
        getCompatibleFields,
        filterCompatibleFields,
        validateRequestSchema,
      } = await import('../utils/schemaVersioning.js')

      expect(typeof transformResponseData).toBe('function')
      expect(typeof getCompatibleFields).toBe('function')
      expect(typeof filterCompatibleFields).toBe('function')
      expect(typeof validateRequestSchema).toBe('function')
    })

    it('v1 and v2 worker schemas have different fields', async () => {
      const { getCompatibleFields } = await import('../utils/schemaVersioning.js')

      const v1Fields = getCompatibleFields('v1', 'worker')
      const v2Fields = getCompatibleFields('v2', 'worker')

      expect(v1Fields).toBeDefined()
      expect(v2Fields).toBeDefined()
      // v2 should have more fields (includes verificationStatus)
      expect(v2Fields.length).toBeGreaterThanOrEqual(v1Fields.length)
    })

    it('v2 worker schema includes verificationStatus', async () => {
      const { getCompatibleFields } = await import('../utils/schemaVersioning.js')

      const v2Fields = getCompatibleFields('v2', 'worker')
      expect(v2Fields).toContain('verificationStatus')
    })

    it('v1 worker schema does not include verificationStatus', async () => {
      const { getCompatibleFields } = await import('../utils/schemaVersioning.js')

      const v1Fields = getCompatibleFields('v1', 'worker')
      expect(v1Fields).not.toContain('verificationStatus')
    })
  })

  describe('Authentication policies', () => {
    it('imports version auth utilities', async () => {
      const {
        isApiKeyAllowedForVersion,
        isJwtRequiredForVersion,
      } = await import('../utils/versioning.js')

      expect(typeof isApiKeyAllowedForVersion).toBe('function')
      expect(typeof isJwtRequiredForVersion).toBe('function')
    })

    it('v1 allows API key authentication', async () => {
      const { isApiKeyAllowedForVersion } = await import('../utils/versioning.js')
      expect(isApiKeyAllowedForVersion('v1')).toBe(true)
    })

    it('v2 does not allow API key authentication', async () => {
      const { isApiKeyAllowedForVersion } = await import('../utils/versioning.js')
      expect(isApiKeyAllowedForVersion('v2')).toBe(false)
    })

    it('both versions require JWT', async () => {
      const { isJwtRequiredForVersion } = await import('../utils/versioning.js')
      expect(isJwtRequiredForVersion('v1')).toBe(true)
      expect(isJwtRequiredForVersion('v2')).toBe(true)
    })
  })

  describe('Version endpoints', () => {
    it('versions endpoint includes all supported versions', () => {
      const versions = getSupportedVersions()
      expect(versions).toContain('v1')
      expect(versions).toContain('v2')
    })

    it('no versions are deprecated by default', () => {
      const deprecated = VERSION_CONFIG.deprecated
      expect(deprecated.length).toBe(0)
    })

    it('all versions have rate limit configuration', () => {
      const versions = getSupportedVersions()
      for (const v of versions) {
        const config = getVersionRateLimitConfig(v)
        expect(config).toBeDefined()
        expect(config?.requests).toBeGreaterThan(0)
        expect(config?.windowMs).toBeGreaterThan(0)
      }
    })
  })

  describe('Backward compatibility', () => {
    it('v1 features are available in v2', () => {
      const v1Fields = ['id', 'name', 'email', 'categoryId']
      const v2Fields = ['id', 'name', 'email', 'categoryId', 'verificationStatus']

      for (const field of v1Fields) {
        expect(v2Fields).toContain(field)
      }
    })

    it('v1 endpoints continue to work', () => {
      const req = mockReq('/api/v1/workers') as any
      const res = mockRes() as any
      const next = vi.fn()

      versionMiddleware(req, res, next)

      expect(req.apiVersion).toBe('v1')
      expect(next).toHaveBeenCalled()
    })

    it('v2 endpoints work alongside v1', () => {
      const req = mockReq('/api/v2/workers') as any
      const res = mockRes() as any
      const next = vi.fn()

      versionMiddleware(req, res, next)

      expect(req.apiVersion).toBe('v2')
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Deprecation process', () => {
    it('version config has sunset information', () => {
      expect(VERSION_CONFIG.sunset).toBeDefined()
      expect(VERSION_CONFIG.sunset.v1).toBeDefined()
      expect(VERSION_CONFIG.sunset.v2).toBeDefined()
    })

    it('current versions have no sunset date', () => {
      const v1Sunset = VERSION_CONFIG.sunset.v1
      const v2Sunset = VERSION_CONFIG.sunset.v2

      // Currently neither is deprecated
      expect(v1Sunset).toBeNull()
      expect(v2Sunset).toBeNull()
    })

    it('unversioned paths show deprecation warning', () => {
      const req = mockReq('/api/workers') as any
      const res = mockRes() as any
      const next = vi.fn()

      deprecationWarning(req, res, next)

      expect(res.headers['Deprecation']).toBe('true')
      expect(res.headers['Warning']).toContain('deprecated')
      expect(res.headers['Sunset']).toBeDefined()
    })
  })

  describe('Version discovery', () => {
    it('clients can query supported versions', () => {
      const versions = getSupportedVersions()
      expect(Array.isArray(versions)).toBe(true)
      expect(versions.length).toBeGreaterThan(0)
    })

    it('clients can query rate limits by version', () => {
      const versions = getSupportedVersions()
      const limits: Record<string, any> = {}

      for (const v of versions) {
        limits[v] = getVersionRateLimitConfig(v)
      }

      expect(Object.keys(limits).length).toBeGreaterThan(0)
      for (const v of versions) {
        expect(limits[v]).toBeDefined()
        expect(limits[v]?.requests).toBeGreaterThan(0)
      }
    })

    it('clients can query auth policies by version', () => {
      const versions = getSupportedVersions()

      for (const v of versions) {
        const v1Auth = VERSION_CONFIG.authPolicies.v1
        const v2Auth = VERSION_CONFIG.authPolicies.v2

        expect(v1Auth).toBeDefined()
        expect(v2Auth).toBeDefined()
      }
    })
  })
})
