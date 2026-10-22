/**
 * Integration tests for the shared error response envelope — issue #1580.
 * A minimal Express app mounts the real errorHandler and notFoundHandler, so
 * every error path goes through the same middleware the API uses.
 */
import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { errorHandler, notFoundHandler } from './errorHandler.js'
import { AppError, ErrorCode } from '@/utils/app-error.js'
import { catchAsync } from '@/utils/catchAsync.js'

function buildApp() {
  const app = express()
  app.use(express.json())

  app.get('/bad-request', (_req, _res, next) => next(new AppError('Name is required', 400, true, ErrorCode.VALIDATION_ERROR)))
  app.get('/unauthorized', (_req, _res, next) => next(new AppError('Token missing', 401, true, ErrorCode.UNAUTHORIZED)))
  app.get('/not-found', (_req, _res, next) => next(new AppError('Job not found', 404, true, ErrorCode.NOT_FOUND)))
  app.get('/boom', catchAsync(async () => {
    throw new Error('database password is hunter2')
  }))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}

const app = buildApp()

const ENVELOPE_KEYS = ['status', 'message', 'code', 'errorCode']

describe('shared error envelope over HTTP', () => {
  it('returns 400 with the envelope for a thrown AppError', async () => {
    const res = await request(app).get('/bad-request')

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({
      status: 'error',
      message: 'Name is required',
      code: 400,
      errorCode: ErrorCode.VALIDATION_ERROR,
    })
    expect(Object.keys(res.body)).toEqual(expect.arrayContaining(ENVELOPE_KEYS))
  })

  it('returns 401 with the envelope for an unauthorized AppError', async () => {
    const res = await request(app).get('/unauthorized')

    expect(res.status).toBe(401)
    expect(res.body).toMatchObject({ status: 'error', message: 'Token missing', code: 401, errorCode: ErrorCode.UNAUTHORIZED })
  })

  it('returns 404 with the envelope for an unknown route', async () => {
    const res = await request(app).get('/does-not-exist')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ status: 'error', code: 404, errorCode: ErrorCode.NOT_FOUND })
    expect(Object.keys(res.body)).toEqual(expect.arrayContaining(ENVELOPE_KEYS))
  })

  it('returns 404 with the envelope for an AppError thrown by a handler', async () => {
    const res = await request(app).get('/not-found')

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ status: 'error', message: 'Job not found', code: 404, errorCode: ErrorCode.NOT_FOUND })
  })

  it('returns a generic 500 envelope and never leaks the internal error message', async () => {
    const res = await request(app).get('/boom')

    expect(res.status).toBe(500)
    expect(res.body).toMatchObject({ status: 'error', code: 500, errorCode: ErrorCode.INTERNAL_ERROR })
    expect(res.body.message).toBe('Internal Server Error')
    expect(JSON.stringify(res.body)).not.toContain('hunter2')
  })
})
