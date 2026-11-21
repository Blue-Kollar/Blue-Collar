/**
 * Tests for the version middleware — issue #1834
 *
 * Verifies:
 *  - versionMiddleware extracts the version from the URL path (/api/v1, /api/v2)
 *  - versionMiddleware falls back to Accept-Version header
 *  - versionMiddleware defaults to the current version when no version is present
 *  - versionMiddleware rejects an unsupported version and falls back to current
 *  - X-API-Version response header is set
 *  - req.versionDeprecated is set when the version is deprecated
 *  - deprecationWarning sets the Deprecation / Warning / Sunset headers
 *  - versionDeprecationMiddleware adds deprecation headers for deprecated versions
 *  - versionDeprecationMiddleware is a no-op for non-deprecated versions
 *  - next() is always called
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import {
  VERSION_CONFIG,
  versionMiddleware,
  deprecationWarning,
  versionDeprecationMiddleware,
} from './version.js'

// ── Minimal mock factories ────────────────────────────────────────────────────

function makeReq(path: string, headers: Record<string, string> = {}): Request {
  return {
    path,
    headers,
    get: (name: string) => headers[name.toLowerCase()] ?? undefined,
  } as unknown as Request
}

function makeRes(): { setHeader: ReturnType<typeof vi.fn>; getHeader: ReturnType<typeof vi.fn> } & Response {
  const headers: Record<string, string> = {}
  const res: any = {
    setHeader: vi.fn((k: string, v: string) => { headers[k] = v }),
    getHeader: vi.fn((k: string) => headers[k]),
  }
  return res
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction
}

// ── versionMiddleware ─────────────────────────────────────────────────────────

describe('versionMiddleware', () => {
  it('extracts v1 from /api/v1/* path', () => {
    const req = makeReq('/api/v1/users')
    const res = makeRes()
    const next = makeNext()
    versionMiddleware(req, res as unknown as Response, next)
    expect(req.apiVersion).toBe('v1')
  })

  it('extracts v2 from /api/v2/* path', () => {
    const req = makeReq('/api/v2/jobs')
    const res = makeRes()
    const next = makeNext()
    versionMiddleware(req, res as unknown as Response, next)
    expect(req.apiVersion).toBe('v2')
  })

  it('falls back to Accept-Version header when path has no version', () => {
    const req = makeReq('/api/users', { 'accept-version': 'v1' })
    const res = makeRes()
    const next = makeNext()
    versionMiddleware(req, res as unknown as Response, next)
    expect(req.apiVersion).toBe('v1')
  })

  it('defaults to the current version when no version info is present', () => {
    const req = makeReq('/api/users')
    const res = makeRes()
    const next = makeNext()
    versionMiddleware(req, res as unknown as Response, next)
    expect(req.apiVersion).toBe(VERSION_CONFIG.current)
  })

  it('falls back to current version for an unsupported version in path', () => {
    const req = makeReq('/api/v99/users')
    const res = makeRes()
    const next = makeNext()
    versionMiddleware(req, res as unknown as Response, next)
    expect(req.apiVersion).toBe(VERSION_CONFIG.current)
  })

  it('sets the X-API-Version response header', () => {
    const req = makeReq('/api/v1/users')
    const res = makeRes()
    const next = makeNext()
    versionMiddleware(req, res as unknown as Response, next)
    expect(res.setHeader).toHaveBeenCalledWith('X-API-Version', 'v1')
  })

  it('always calls next()', () => {
    const req = makeReq('/api/v1/users')
    const res = makeRes()
    const next = makeNext()
    versionMiddleware(req, res as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
    expect(next).toHaveBeenCalledWith()
  })

  it('sets req.versionDeprecated when the version is in the deprecated list', () => {
    // Temporarily mark v1 as deprecated for this test.
    const original = [...VERSION_CONFIG.deprecated]
    ;(VERSION_CONFIG.deprecated as string[]).push('v1')
    try {
      const req = makeReq('/api/v1/users')
      const res = makeRes()
      const next = makeNext()
      versionMiddleware(req, res as unknown as Response, next)
      expect(req.versionDeprecated).toBe(true)
    } finally {
      ;(VERSION_CONFIG.deprecated as string[]).length = 0
      original.forEach(v => (VERSION_CONFIG.deprecated as string[]).push(v))
    }
  })
})

// ── deprecationWarning ────────────────────────────────────────────────────────

describe('deprecationWarning', () => {
  it('sets Deprecation header to "true"', () => {
    const req = makeReq('/api/users')
    const res = makeRes()
    const next = makeNext()
    deprecationWarning(req, res as unknown as Response, next)
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true')
  })

  it('sets Warning header with migration guidance', () => {
    const req = makeReq('/api/users')
    const res = makeRes()
    const next = makeNext()
    deprecationWarning(req, res as unknown as Response, next)
    const warningCall = res.setHeader.mock.calls.find(([k]: [string]) => k === 'Warning')
    expect(warningCall).toBeDefined()
    expect(warningCall?.[1]).toMatch(/v1/i)
  })

  it('sets Sunset header', () => {
    const req = makeReq('/api/users')
    const res = makeRes()
    const next = makeNext()
    deprecationWarning(req, res as unknown as Response, next)
    const sunsetCall = res.setHeader.mock.calls.find(([k]: [string]) => k === 'Sunset')
    expect(sunsetCall).toBeDefined()
  })

  it('calls next()', () => {
    const req = makeReq('/api/users')
    const res = makeRes()
    const next = makeNext()
    deprecationWarning(req, res as unknown as Response, next)
    expect(next).toHaveBeenCalledOnce()
  })
})

// ── versionDeprecationMiddleware ──────────────────────────────────────────────

describe('versionDeprecationMiddleware', () => {
  it('is a no-op when req.versionDeprecated is falsy', () => {
    const req = makeReq('/api/v2/users')
    const res = makeRes()
    const next = makeNext()
    versionDeprecationMiddleware(req, res as unknown as Response, next)
    expect(res.setHeader).not.toHaveBeenCalled()
    expect(next).toHaveBeenCalledOnce()
  })

  it('adds deprecation headers when req.versionDeprecated is true', () => {
    const req = makeReq('/api/v1/users') as Request & { versionDeprecated: boolean; apiVersion: string }
    req.versionDeprecated = true
    req.apiVersion = 'v1'
    const res = makeRes()
    const next = makeNext()
    versionDeprecationMiddleware(req, res as unknown as Response, next)
    expect(res.setHeader).toHaveBeenCalledWith('Deprecation', 'true')
    const warningCall = res.setHeader.mock.calls.find(([k]: [string]) => k === 'Warning')
    expect(warningCall).toBeDefined()
    expect(next).toHaveBeenCalledOnce()
  })
})
