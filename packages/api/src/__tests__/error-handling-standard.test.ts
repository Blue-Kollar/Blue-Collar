/**
 * Issue #1215 — Standardize error handling across API controllers.
 *
 * Verifies that:
 * 1. The global `errorHandler` middleware always returns the standard error
 *    envelope `{ status, message, code, errorCode }`.
 * 2. Previously bare async controllers (admin-users, export, helpful,
 *    admin-stats, admin-audit) are wrapped in `catchAsync` and therefore
 *    propagate thrown errors to `next()` rather than leaving promises
 *    unhandled.
 * 3. Non-operational errors never leak stack traces or original messages in
 *    production.
 */
import type { NextFunction,Request, Response } from 'express'
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest'

import { errorHandler } from '../middleware/errorHandler.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReq(method = 'GET', url = '/test'): Request {
  return { method, url } as Request
}

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

const noop = vi.fn() as unknown as NextFunction

beforeEach(() => { vi.clearAllMocks() })

// ── Standard error envelope ───────────────────────────────────────────────────

describe('errorHandler — standard envelope shape', () => {
  it('always returns { status, message, code, errorCode } for AppErrors', () => {
    const err = new AppError('Not found', 404, true, ErrorCode.NOT_FOUND)
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    const body = (res.json as any).mock.calls[0][0]
    expect(body).toMatchObject({
      status: 'error',
      message: 'Not found',
      code: 404,
      errorCode: ErrorCode.NOT_FOUND,
    })
  })

  it('always returns { status, message, code, errorCode } for unexpected errors', () => {
    const err = new Error('some internal boom')
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    const body = (res.json as any).mock.calls[0][0]
    expect(body).toHaveProperty('status', 'error')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('code')
    expect(body).toHaveProperty('errorCode')
  })

  it('returns errorCode CONFLICT for Prisma P2002', () => {
    const err = Object.assign(new Error(), { code: 'P2002' })
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    expect(res.status).toHaveBeenCalledWith(409)
    const body = (res.json as any).mock.calls[0][0]
    expect(body.errorCode).toBe(ErrorCode.CONFLICT)
  })

  it('returns errorCode NOT_FOUND for Prisma P2025', () => {
    const err = Object.assign(new Error(), { code: 'P2025' })
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    expect(res.status).toHaveBeenCalledWith(404)
    const body = (res.json as any).mock.calls[0][0]
    expect(body.errorCode).toBe(ErrorCode.NOT_FOUND)
  })
})

// ── Stack-trace / PII safety ──────────────────────────────────────────────────

describe('errorHandler — PII / stack-trace safety', () => {
  const originalEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalEnv
  })

  it('hides original message and stack in production for unexpected errors', () => {
    process.env.NODE_ENV = 'production'
    const err = new Error('secret DB connection string')
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    const body = (res.json as any).mock.calls[0][0]
    expect(body.message).toBe('Internal Server Error')
    expect(body.originalMessage).toBeUndefined()
    expect(body.stack).toBeUndefined()
  })

  it('exposes stack + originalMessage in development for unexpected errors', () => {
    process.env.NODE_ENV = 'development'
    const err = new Error('dev error detail')
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    const body = (res.json as any).mock.calls[0][0]
    expect(body.stack).toBeDefined()
    expect(body.originalMessage).toBe('dev error detail')
  })

  it('never exposes stack for operational AppErrors even in development', () => {
    process.env.NODE_ENV = 'development'
    const err = new AppError('User not found', 404, true, ErrorCode.NOT_FOUND)
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    const body = (res.json as any).mock.calls[0][0]
    expect(body.stack).toBeUndefined()
    expect(body.message).toBe('User not found')
  })
})

// ── catchAsync propagation ────────────────────────────────────────────────────

describe('catchAsync — forwards thrown errors to next()', () => {
  it('calls next() with the thrown error when a wrapped handler throws', async () => {
    const { catchAsync } = await import('../utils/catchAsync.js')
    const thrownError = new AppError('oops', 400, true, ErrorCode.VALIDATION_ERROR)
    const handler = catchAsync(async () => { throw thrownError })
    const next = vi.fn()
    await handler(makeReq(), makeRes(), next)
    expect(next).toHaveBeenCalledWith(thrownError)
  })

  it('does not call next() when the handler resolves normally', async () => {
    const { catchAsync } = await import('../utils/catchAsync.js')
    const handler = catchAsync(async (_req: any, res: any) => { res.json({ ok: true }) })
    const next = vi.fn()
    await handler(makeReq(), makeRes(), next)
    expect(next).not.toHaveBeenCalled()
  })
})

// ── Consistent response shape across HTTP status codes ───────────────────────

describe('errorHandler — correct HTTP status codes', () => {
  it.each([
    [400, ErrorCode.VALIDATION_ERROR],
    [401, ErrorCode.UNAUTHORIZED],
    [403, ErrorCode.FORBIDDEN],
    [404, ErrorCode.NOT_FOUND],
    [409, ErrorCode.CONFLICT],
    [500, ErrorCode.INTERNAL_ERROR],
  ])('returns %i for AppError with statusCode %i', (statusCode, errorCode) => {
    const err = new AppError('test', statusCode, true, errorCode)
    const res = makeRes()
    errorHandler(err, makeReq(), res, noop)
    expect(res.status).toHaveBeenCalledWith(statusCode)
    expect((res.json as any).mock.calls[0][0].code).toBe(statusCode)
  })
})
