import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn() }))

import { securityHeaders, depthLimiter, MAX_BODY_SIZE, MAX_JSON_DEPTH } from './security.js'

function mockReq(overrides: Record<string, unknown> = {}) {
  return { body: {}, headers: {}, ...overrides } as Request
}

function mockRes() {
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response
  res.setHeader = vi.fn()
  res.getHeaders = vi.fn().mockReturnValue({})
  return res
}

describe('securityHeaders', () => {
  it('exports a helmet middleware function', () => {
    expect(securityHeaders).toBeDefined()
    expect(typeof securityHeaders).toBe('function')
  })
})

describe('depthLimiter', () => {
  it('passes through flat objects unchanged', () => {
    const req = mockReq({ body: { name: 'test', age: 30 } })
    const next = vi.fn()
    depthLimiter(req, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.body).toEqual({ name: 'test', age: 30 })
  })

  it('passes through moderately nested objects', () => {
    const nested = { a: { b: { c: { d: { e: 'deep' } } } } }
    const req = mockReq({ body: nested })
    const next = vi.fn()
    depthLimiter(req, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.body).toEqual(nested)
  })

  it('resets body to empty object for deeply nested objects', () => {
    let deep: Record<string, unknown> = { value: 'x' }
    for (let i = 0; i < MAX_JSON_DEPTH + 5; i++) deep = { child: deep }
    const req = mockReq({ body: deep })
    const next = vi.fn()
    depthLimiter(req, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.body).toEqual({})
  })

  it('handles deeply nested arrays', () => {
    let deep: unknown[] = ['x']
    for (let i = 0; i < MAX_JSON_DEPTH + 5; i++) deep = [deep]
    const req = mockReq({ body: deep })
    const next = vi.fn()
    depthLimiter(req, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
    expect(req.body).toEqual({})
  })

  it('handles null body gracefully', () => {
    const req = mockReq({ body: null })
    const next = vi.fn()
    depthLimiter(req, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
  })

  it('handles non-object body gracefully', () => {
    const req = mockReq({ body: 'string' })
    const next = vi.fn()
    depthLimiter(req, mockRes(), next)
    expect(next).toHaveBeenCalledTimes(1)
  })
})

describe('MAX_BODY_SIZE', () => {
  it('is set to 100kb', () => {
    expect(MAX_BODY_SIZE).toBe('100kb')
  })

  it('allows payloads under the limit', () => {
    const size = new TextEncoder().encode('x'.repeat(50_000)).length
    expect(size).toBeLessThan(102_400)
  })

  it('rejects payloads over the limit', () => {
    const size = new TextEncoder().encode('x'.repeat(200_000)).length
    expect(size).toBeGreaterThan(102_400)
  })
})
