/**
 * Tests for idempotency middleware (#517)
 */
import type { NextFunction,Request, Response } from 'express'
import { beforeEach,describe, expect, it, vi } from 'vitest'

vi.mock('../db.js', () => ({
  db: {
    idempotencyKey: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}))

import { db } from '../db.js'
import { idempotency } from '../middleware/idempotency.js'

function makeReqRes(headers: Record<string, string> = {}, userId?: string) {
  const req = {
    headers,
    user: userId ? { id: userId, role: 'curator' } : undefined,
    params: {},
  } as unknown as Request

  const jsonMock = vi.fn().mockReturnThis()
  const statusMock = vi.fn().mockReturnThis()
  const res = {
    json: jsonMock,
    status: statusMock,
    statusCode: 201,
  } as unknown as Response
  // make status().json() chain work
  statusMock.mockReturnValue({ json: jsonMock })

  const next = vi.fn() as unknown as NextFunction
  return { req, res, next, jsonMock, statusMock }
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls next() when no Idempotency-Key header is present', async () => {
    const { req, res, next } = makeReqRes()
    idempotency(req, res, next)
    await new Promise((r) => setTimeout(r, 10))
    expect(next).toHaveBeenCalled()
  })

  it('calls next() on first request (no stored response)', async () => {
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(null)
    const { req, res, next } = makeReqRes({ 'idempotency-key': 'key-abc' }, 'user-1')
    idempotency(req, res, next)
    await new Promise((r) => setTimeout(r, 10))
    expect(next).toHaveBeenCalled()
  })

  it('returns cached response on retry', async () => {
    const stored = {
      id: 'idem-1',
      key: 'key-abc',
      userId: 'user-1',
      responseBody: { status: 'success', data: { id: 'w-1' } },
      statusCode: 201,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(stored as any)
    const { req, res, next, statusMock, jsonMock } = makeReqRes({ 'idempotency-key': 'key-abc' }, 'user-1')
    idempotency(req, res, next)
    await new Promise((r) => setTimeout(r, 10))
    expect(next).not.toHaveBeenCalled()
    expect(statusMock).toHaveBeenCalledWith(201)
    expect(jsonMock).toHaveBeenCalledWith(stored.responseBody)
  })

  it('calls next() when stored response is expired', async () => {
    const stored = {
      id: 'idem-2',
      key: 'key-expired',
      userId: 'user-1',
      responseBody: { status: 'success' },
      statusCode: 201,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() - 1000), // expired
    }
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(stored as any)
    const { req, res, next } = makeReqRes({ 'idempotency-key': 'key-expired' }, 'user-1')
    idempotency(req, res, next)
    await new Promise((r) => setTimeout(r, 10))
    expect(next).toHaveBeenCalled()
  })

  it('stores response after successful processing', async () => {
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(null)
    const { req, res, next } = makeReqRes({ 'idempotency-key': 'key-store' }, 'user-2')
    idempotency(req, res, next)
    await new Promise((r) => setTimeout(r, 10))
    // Simulate controller calling res.json
    ;(res as any).statusCode = 201
    res.json({ status: 'success', data: { id: 'new-worker' } })
    await new Promise((r) => setTimeout(r, 10))
    expect(db.idempotencyKey.upsert).toHaveBeenCalled()
  })
})
