/**
 * Tests for GET /health and GET /ready endpoints (#516)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

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

const mockQueueClient = { ping: vi.fn().mockResolvedValue('PONG') }
vi.mock('../queue/index.js', () => ({
  emailQueue: { client: Promise.resolve(mockQueueClient) },
}))

vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))

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
import { db } from '../db.js'
import { redis } from '../config/redis.js'

describe('GET /health', () => {
  it('returns 200 with status ok immediately (liveness only, no dependency checks)', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })
})

describe.each(['/readyz', '/ready'])('GET %s', (path) => {
  beforeEach(() => {
    vi.mocked(db.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
    vi.mocked(redis.ping).mockResolvedValue('PONG')
    mockQueueClient.ping.mockResolvedValue('PONG')
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 200 } as Response)
  })

  it('returns 200 when database, redis, queue, and horizon RPC are all up', async () => {
    const res = await request(app).get(path)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
    expect(res.body.checks.database.status).toBe('ok')
    expect(res.body.checks.redis.status).toBe('ok')
    expect(res.body.checks.queue.status).toBe('ok')
    expect(res.body.checks.horizon.status).toBe('ok')
    expect(res.body.service).toBe('bluecollar-api')
    expect(res.body.timestamp).toBeDefined()
  })

  it('returns 503 when the database is down', async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(new Error('Connection refused'))
    const res = await request(app).get(path)
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.checks.database.status).toBe('error')
    expect(res.body.checks.database.error).toBe('Connection refused')
  })

  it('returns 503 when redis is down', async () => {
    vi.mocked(redis.ping).mockRejectedValue(new Error('Redis unavailable'))
    const res = await request(app).get(path)
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.checks.redis.status).toBe('error')
  })

  it('returns 503 when the job queue is unreachable', async () => {
    mockQueueClient.ping.mockRejectedValue(new Error('ECONNREFUSED'))
    const res = await request(app).get(path)
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.checks.queue.status).toBe('error')
    expect(res.body.checks.database.status).toBe('ok') // other deps unaffected
  })

  it('returns 503 when Horizon RPC is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('fetch failed'))
    const res = await request(app).get(path)
    expect(res.status).toBe(503)
    expect(res.body.status).toBe('degraded')
    expect(res.body.checks.horizon.status).toBe('error')
  })

  it('returns 503 when Horizon RPC responds with a non-2xx status', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 502 } as Response)
    const res = await request(app).get(path)
    expect(res.status).toBe(503)
    expect(res.body.checks.horizon.status).toBe('error')
  })
})
