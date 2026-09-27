/**
 * Tests for requestId middleware — issue #1238
 *
 * Verifies:
 *  - A UUID is generated and attached to req.id
 *  - X-Request-ID response header is set
 *  - Inbound X-Request-ID is honoured (upstream proxy passthrough)
 *  - Inbound whitespace-only / empty X-Request-ID is treated as absent
 *  - Generated IDs are unique across requests
 *  - next() is always called
 */
import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { requestId } from './requestId.js'

// ── Minimal mock factories ────────────────────────────────────────────────────

function makeReq(inboundId?: string): Request {
  return {
    headers: inboundId !== undefined ? { 'x-request-id': inboundId } : {},
    socket: { remoteAddress: '127.0.0.1' },
  } as unknown as Request
}

function makeRes(): { setHeader: ReturnType<typeof vi.fn>; [k: string]: unknown } {
  return { setHeader: vi.fn() }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('requestId middleware', () => {
  it('attaches a UUID to req.id when no inbound header is present', () => {
    const req  = makeReq()
    const res  = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requestId(req, res as unknown as Response, next)

    expect(typeof req.id).toBe('string')
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('sets the X-Request-ID response header', () => {
    const req  = makeReq()
    const res  = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requestId(req, res as unknown as Response, next)

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', req.id)
  })

  it('uses the inbound X-Request-ID if provided', () => {
    const existingId = 'my-trace-id-from-alb'
    const req  = makeReq(existingId)
    const res  = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requestId(req, res as unknown as Response, next)

    expect(req.id).toBe(existingId)
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId)
  })

  it('ignores an inbound X-Request-ID that is only whitespace', () => {
    const req  = makeReq('   ')
    const res  = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requestId(req, res as unknown as Response, next)

    // Should generate a new UUID, not use the whitespace string
    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('ignores an empty inbound X-Request-ID string', () => {
    const req  = makeReq('')
    const res  = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requestId(req, res as unknown as Response, next)

    expect(req.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('always calls next()', () => {
    const req  = makeReq()
    const res  = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requestId(req, res as unknown as Response, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(next).toHaveBeenCalledWith() // called with no arguments (not an error)
  })

  it('generates a unique ID for each request', () => {
    const ids = Array.from({ length: 20 }, () => {
      const req  = makeReq()
      const res  = makeRes()
      const next = vi.fn() as unknown as NextFunction
      requestId(req, res as unknown as Response, next)
      return req.id
    })

    const unique = new Set(ids)
    expect(unique.size).toBe(20)
  })

  it('echo-header: X-Request-ID response equals req.id', () => {
    const req  = makeReq()
    const res  = makeRes()
    const next = vi.fn() as unknown as NextFunction

    requestId(req, res as unknown as Response, next)

    const [headerName, headerValue] = res.setHeader.mock.calls[0]
    expect(headerName).toBe('X-Request-ID')
    expect(headerValue).toBe(req.id)
  })
})
