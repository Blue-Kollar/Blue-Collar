/**
 * Tests for GET /health and GET /ready endpoints (#516)
 */
import request from 'supertest'
import { beforeEach,describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret'
process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.APP_URL = 'http://localhost:3000'

vi.mock('../db.js', () => ({
  db: { $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]) },
}))

vi.mock('../config/redis.js', () => ({
  redis: { connect: vi.fn().mockResolvedValue(undefined), ping: vi.fn().mockResolvedValue('PONG') },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-secret',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'test',
    MAIL_PASS: 'test',
    APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('../config/passport.js', () => ({ default: { initialize: () => (_: any, __: any, next: any) => next() } }))
vi.mock('../middleware/requestLogger.js', () => ({ requestLogger: (_: any, __: any, next: any) => next() }))
vi.mock('../events/index.js', () => ({ registerEventHandlers: vi.fn() }))
vi.mock('../mailer/transport.js', () => ({ transporter: { sendMail: vi.fn() } }))

import app from '../app.js'
import { redis } from '../config/redis.js'
import { db } from '../db.js'

describe('GET /health', () => {
  it('returns 200 with status ok immediately', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe('GET /ready', () => {
  beforeEach(() => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
    vi.mocked(redis.ping).mockResolvedValue('PONG')
  })

  it('returns 200 when DB and Redis are up', async () => {
    const res = await request(app).get('/ready')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.checks.database.status).toBe('ok')
    expect(res.body.checks.redis.status).toBe('ok')
    expect(res.body.service).toBe('bluecollar-api')
    expect(res.body.timestamp).toBeDefined()
  })

  it('returns 503 when DB is down', async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error('Connection refused'))
    const res = await request(app).get('/ready')
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.checks.database.status).toBe('error')
    expect(res.body.checks.database.error).toBe('Connection refused')
  })

  it('returns 503 when Redis is down', async () => {
    vi.mocked(redis.ping).mockRejectedValue(new Error('Redis unavailable'))
    const res = await request(app).get('/ready')
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.checks.redis.status).toBe('error')
  })
})
