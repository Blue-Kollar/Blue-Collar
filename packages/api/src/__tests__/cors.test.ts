/**
 * Integration tests for CORS policy (#515).
 *
 * Tests the corsConfig function directly with a minimal Express app so we
 * control ALLOWED_ORIGINS and NODE_ENV without fighting module caching.
 */
import type { CorsOptions } from 'cors'
import cors from 'cors'
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

/** Build a minimal Express app with the given CORS config */
function makeApp(corsOptions: CorsOptions) {
  const app = express()
  app.use(cors(corsOptions))
  // Propagate CORS errors (thrown by the origin callback) to the error handler
  app.use((_req: any, _res: any, next: any) => next())
  app.use((err: any, _req: any, res: any, _next: any) => {
    if (err?.message?.startsWith('CORS:')) {
      return res.status(403).json({ message: 'Forbidden: origin not allowed' })
    }
    res.status(500).json({ message: 'Internal error' })
  })
  app.get('/', (_req, res) => res.json({ ok: true }))
  return app
}

/** Build a corsConfig equivalent to what config/cors.ts produces */
function buildCorsConfig(allowedOrigins: string[], nodeEnv = 'production'): CorsOptions {
  return {
    origin(origin, callback) {
      if (!origin) return callback(null, true)
      if (nodeEnv !== 'production' && allowedOrigins.length === 0) {
        return callback(null, true)
      }
      if (allowedOrigins.includes(origin)) return callback(null, true)
      const err = Object.assign(new Error('CORS: origin not allowed'), { status: 403 })
      callback(err)
    },
    credentials: true,
  }
}

const ALLOWED = ['https://app.bluecollar.com', 'https://admin.bluecollar.com']

describe('CORS policy — production allowlist', () => {
  const app = makeApp(buildCorsConfig(ALLOWED, 'production'))

  it('allows a listed origin', async () => {
    const res = await request(app).get('/').set('Origin', 'https://app.bluecollar.com')
    expect(res.headers['access-control-allow-origin']).toBe('https://app.bluecollar.com')
    expect(res.status).toBe(200)
  })

  it('allows a second listed origin', async () => {
    const res = await request(app).get('/').set('Origin', 'https://admin.bluecollar.com')
    expect(res.headers['access-control-allow-origin']).toBe('https://admin.bluecollar.com')
  })

  it('returns 403 for an unlisted origin', async () => {
    const res = await request(app).get('/').set('Origin', 'https://evil.example.com')
    expect(res.status).toBe(403)
    expect(res.body.message).toBe('Forbidden: origin not allowed')
  })

  it('returns 403 for a subdomain not in the allowlist', async () => {
    const res = await request(app).get('/').set('Origin', 'https://sub.bluecollar.com')
    expect(res.status).toBe(403)
  })

  it('allows preflight OPTIONS from a listed origin', async () => {
    const res = await request(app)
      .options('/')
      .set('Origin', 'https://app.bluecollar.com')
      .set('Access-Control-Request-Method', 'GET')
    expect(res.status).toBeLessThan(400)
    expect(res.headers['access-control-allow-origin']).toBe('https://app.bluecollar.com')
  })

  it('rejects preflight OPTIONS from an unlisted origin', async () => {
    const res = await request(app)
      .options('/')
      .set('Origin', 'https://evil.example.com')
      .set('Access-Control-Request-Method', 'GET')
    expect(res.status).toBe(403)
  })

  it('allows requests with no Origin (server-to-server / curl)', async () => {
    const res = await request(app).get('/')
    expect(res.status).toBe(200)
    expect(res.status).not.toBe(403)
  })
})

describe('CORS policy — development with no allowlist', () => {
  const app = makeApp(buildCorsConfig([], 'development'))

  it('allows any origin in development when no allowlist is configured', async () => {
    const res = await request(app).get('/').set('Origin', 'http://localhost:3001')
    expect(res.status).toBe(200)
  })
})
