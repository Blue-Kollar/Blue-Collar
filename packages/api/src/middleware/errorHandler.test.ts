import type { NextFunction,Request, Response } from 'express'
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest'

import { AppError } from '../utils/AppError.js'
import { errorHandler, notFoundHandler } from './errorHandler.js'

function makeReq(method = 'GET', url = '/test') {
  return { method, url } as Request
}

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

const next = vi.fn() as unknown as NextFunction

beforeEach(() => vi.clearAllMocks())

// ── errorHandler ──────────────────────────────────────────────────────────────

describe('errorHandler', () => {
  it('returns 500 for a generic Error', () => {
    const err = new Error('boom')
    const res = makeRes()
    errorHandler(err, makeReq(), res, next)
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Internal Server Error' }))
  })

  it('returns the AppError statusCode and message for operational errors', () => {
    const err = new AppError('Not found', 404)
    const res = makeRes()
    errorHandler(err, makeReq(), res, next)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Not found', code: 404 }))
  })

  it('returns 422 for validation AppError', () => {
    const err = new AppError('Validation failed', 422)
    const res = makeRes()
    errorHandler(err, makeReq(), res, next)
    expect(res.status).toHaveBeenCalledWith(422)
  })

  it('hides original message for non-operational errors in production', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const err = new Error('secret internal detail')
    const res = makeRes()
    errorHandler(err, makeReq(), res, next)
    const body = (res.json as any).mock.calls[0][0]
    expect(body.message).toBe('Internal Server Error')
    expect(body.originalMessage).toBeUndefined()
    process.env.NODE_ENV = original
  })

  it('includes stack in development for non-operational errors', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const err = new Error('dev error')
    const res = makeRes()
    errorHandler(err, makeReq(), res, next)
    const body = (res.json as any).mock.calls[0][0]
    expect(body.stack).toBeDefined()
    process.env.NODE_ENV = original
  })
})

// ── notFoundHandler ───────────────────────────────────────────────────────────

describe('notFoundHandler', () => {
  it('calls next with a 404 AppError', () => {
    const nextFn = vi.fn()
    notFoundHandler(makeReq('GET', '/missing'), makeRes(), nextFn)
    expect(nextFn).toHaveBeenCalledOnce()
    const err = nextFn.mock.calls[0][0]
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(404)
  })
})
