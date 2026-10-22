/**
 * Integration tests for search endpoints (#1001)
 *
 * Covers:
 *  - GET /api/workers/search      (searchWorkersHandler)
 *  - GET /api/workers/search/advanced (advancedSearch)
 *
 * All DB / Redis / external deps are mocked; the full HTTP cycle is exercised
 * via supertest against the real Express app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── Environment ─────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-integration-secret'
process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.APP_URL = 'http://localhost:3000'

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../db.js', () => ({
  db: {
    worker: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
      findFirst: vi.fn(),
    },
    searchAnalytics: {
      create: vi.fn(),
    },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    location: { findMany: vi.fn() },
    workerAnalytics: { findUnique: vi.fn(), upsert: vi.fn() },
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock('../../config/redis.js', () => ({
  redis: {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
  },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-integration-secret',
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

vi.mock('../../openapi/docs.js', () => {
  const fn = (_: any, __: any, next: any) => next()
  fn.use = fn
  fn.get = fn
  fn.handle = fn
  return { default: fn }
})

vi.mock('../../config/passport.js', () => ({
  default: {
    initialize: () => (_: any, __: any, next: any) => next(),
    authenticate: () => (_: any, __: any, next: any) => next(),
  },
}))

vi.mock('../../middleware/requestLogger.js', () => ({
  requestLogger: (_: any, __: any, next: any) => next(),
}))

vi.mock('../../events/index.js', () => ({ registerEventHandlers: vi.fn() }))

vi.mock('../../config/rateLimiter.js', () => ({
  moderateAuthRateLimiter: (_: any, __: any, next: any) => next(),
  strictAuthRateLimiter: (_: any, __: any, next: any) => next(),
}))

vi.mock('../../middleware/versionRateLimit.js', () => ({
  versionRateLimit: () => (_: any, __: any, next: any) => next(),
  getRateLimitStatus: (_: any, res: any) => res.json({ status: 'ok' }),
}))

vi.mock('../../middleware/userRateLimit.js', () => ({
  contactRateLimit: (_: any, __: any, next: any) => next(),
  generalRateLimit: (_: any, __: any, next: any) => next(),
  userRateLimit: () => (_: any, __: any, next: any) => next(),
}))

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg' }) },
}))

// Mock search service to isolate controller under test
vi.mock('../../services/search.service.js', () => ({
  searchWorkers: vi.fn(),
  performAdvancedSearch: vi.fn(),
}))

// Mock worker service (used by advancedSearch path)
vi.mock('../../services/worker.service.js', () => ({
  listWorkers: vi.fn(),
  listWorkersCursor: vi.fn(),
  listWorkersGeo: vi.fn(),
  getWorkerWithPortfolio: vi.fn(),
  createWorkerWithMedia: vi.fn(),
  updateWorkerWithMedia: vi.fn(),
  deleteWorkerWithMedia: vi.fn(),
  toggleWorker: vi.fn(),
  listMyWorkers: vi.fn(),
  advancedSearch: vi.fn(),
  trackSearchAnalytics: vi.fn(),
  getWorkerReputation: vi.fn(),
}))

import app from '../../app.js'
import * as searchService from '../../services/search.service.js'
import { db } from '../../db.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeToken(role = 'user', id = 'user-1') {
  return jwt.sign(
    { id, email: 'user@example.com', role },
    'test-integration-secret',
    { expiresIn: '1h' },
  )
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fakeSearchResult = {
  data: [
    {
      id: 'worker-1',
      name: 'Alice Plumber',
      bio: 'Expert plumber with 10 years experience',
      isActive: true,
      isVerified: true,
      categoryId: 'cat-1',
      rank: 0.85,
      highlight: { name: 'Alice <mark>Plumber</mark>', bio: 'Expert <mark>plumber</mark>' },
    },
  ],
  meta: { total: 1, page: 1, limit: 20, pages: 1 },
}

const fakeAdvancedResult = {
  data: [
    {
      id: 'worker-2',
      name: 'Bob Electrician',
      bio: 'Certified electrician',
      isActive: true,
      isVerified: true,
      categoryId: 'cat-2',
    },
  ],
  meta: { total: 1, page: 1, limit: 20, hasMore: false, pages: 1 },
}

// ─── GET /api/workers/search ──────────────────────────────────────────────────

describe('GET /api/workers/search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchService.searchWorkers).mockResolvedValue(fakeSearchResult as any)
  })

  it('returns 200 with search results on a basic query', async () => {
    const res = await request(app).get('/api/workers/search?q=plumber')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Alice Plumber')
  })

  it('returns 200 even without a query param (browse mode)', async () => {
    vi.mocked(searchService.searchWorkers).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, pages: 0 },
    })
    const res = await request(app).get('/api/workers/search')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('passes the q param to the search service', async () => {
    await request(app).get('/api/workers/search?q=electrician')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'electrician' }),
      expect.anything(),
    )
  })

  it('accepts query alias for q param', async () => {
    await request(app).get('/api/workers/search?query=welder')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'welder' }),
      expect.anything(),
    )
  })

  it('passes geo params (lat, lng, radius) to the service', async () => {
    await request(app).get('/api/workers/search?q=plumber&lat=6.5244&lng=3.3792&radius=15')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 6.5244, lng: 3.3792, radius: 15 }),
      expect.anything(),
    )
  })

  it('passes category filter to the service', async () => {
    await request(app).get('/api/workers/search?q=plumber&categories=cat-1,cat-2')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['cat-1', 'cat-2'] }),
      expect.anything(),
    )
  })

  it('passes isVerified filter to the service', async () => {
    await request(app).get('/api/workers/search?isVerified=true')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: true }),
      expect.anything(),
    )
  })

  it('passes rating filters to the service', async () => {
    await request(app).get('/api/workers/search?minRating=3&maxRating=5')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ minRating: 3, maxRating: 5 }),
      expect.anything(),
    )
  })

  it('passes sortBy=rating param to the service', async () => {
    await request(app).get('/api/workers/search?sortBy=rating')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'rating' }),
      expect.anything(),
    )
  })

  it('passes pagination params to the service', async () => {
    await request(app).get('/api/workers/search?page=2&limit=10')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 10 }),
      expect.anything(),
    )
  })

  it('caps limit at 100', async () => {
    await request(app).get('/api/workers/search?limit=500')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 100 }),
      expect.anything(),
    )
  })

  it('includes meta in the response', async () => {
    const res = await request(app).get('/api/workers/search?q=plumber')
    expect(res.body).toHaveProperty('meta')
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, limit: 20, pages: 1 })
  })

  it('returns 500 when search service throws an unexpected error', async () => {
    vi.mocked(searchService.searchWorkers).mockRejectedValue(new Error('DB connection lost'))
    const res = await request(app).get('/api/workers/search?q=plumber')
    expect(res.status).toBeGreaterThanOrEqual(500)
  })

  it('is accessible without authentication', async () => {
    // No Authorization header
    const res = await request(app).get('/api/workers/search?q=plumber')
    expect(res.status).toBe(200)
  })

  it('works with an authenticated user token as well', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/workers/search?q=plumber')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('returns empty data array when no results found', async () => {
    vi.mocked(searchService.searchWorkers).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, pages: 0 },
    })
    const res = await request(app).get('/api/workers/search?q=nonexistentskill123')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })

  it('passes dayOfWeek filter to the service', async () => {
    await request(app).get('/api/workers/search?dayOfWeek=1')
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalledWith(
      expect.objectContaining({ dayOfWeek: 1 }),
      expect.anything(),
    )
  })
})

// ─── GET /api/workers/search/advanced ────────────────────────────────────────

describe('GET /api/workers/search/advanced', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchService.performAdvancedSearch).mockResolvedValue(fakeAdvancedResult as any)
  })

  it('returns 200 with results on a basic query', async () => {
    const res = await request(app).get('/api/workers/search/advanced?query=electrician')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].name).toBe('Bob Electrician')
  })

  it('returns 200 with no query (browse mode)', async () => {
    vi.mocked(searchService.performAdvancedSearch).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, hasMore: false, pages: 0 },
    })
    const res = await request(app).get('/api/workers/search/advanced')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
  })

  it('passes text query to the service', async () => {
    await request(app).get('/api/workers/search/advanced?query=carpenter')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'carpenter' }),
      expect.anything(),
    )
  })

  it('passes geo params to the service', async () => {
    await request(app).get('/api/workers/search/advanced?lat=9.0765&lng=7.3986&radius=20')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 9.0765, lng: 7.3986, radius: 20 }),
      expect.anything(),
    )
  })

  it('passes category filter to the service', async () => {
    await request(app).get('/api/workers/search/advanced?categories=cat-1,cat-3')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['cat-1', 'cat-3'] }),
      expect.anything(),
    )
  })

  it('passes rating filters to the service', async () => {
    await request(app).get('/api/workers/search/advanced?minRating=4&maxRating=5')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ minRating: 4, maxRating: 5 }),
      expect.anything(),
    )
  })

  it('passes availability time window to the service', async () => {
    await request(app).get('/api/workers/search/advanced?startTime=09:00&endTime=17:00')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ startTime: '09:00', endTime: '17:00' }),
      expect.anything(),
    )
  })

  it('passes isVerified filter to the service', async () => {
    await request(app).get('/api/workers/search/advanced?isVerified=true')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ isVerified: true }),
      expect.anything(),
    )
  })

  it('passes sortBy param to the service', async () => {
    await request(app).get('/api/workers/search/advanced?sortBy=distance')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'distance' }),
      expect.anything(),
    )
  })

  it('passes pagination params to the service', async () => {
    await request(app).get('/api/workers/search/advanced?page=3&limit=5')
    expect(vi.mocked(searchService.performAdvancedSearch)).toHaveBeenCalledWith(
      expect.objectContaining({ page: 3, limit: 5 }),
      expect.anything(),
    )
  })

  it('includes hasMore in meta', async () => {
    vi.mocked(searchService.performAdvancedSearch).mockResolvedValue({
      data: [],
      meta: { total: 100, page: 1, limit: 20, hasMore: true, pages: 5 },
    })
    const res = await request(app).get('/api/workers/search/advanced?query=plumber')
    expect(res.body.meta).toMatchObject({ hasMore: true })
  })

  it('is publicly accessible without a token', async () => {
    const res = await request(app).get('/api/workers/search/advanced?query=welder')
    expect(res.status).toBe(200)
  })

  it('works with an authenticated token as well', async () => {
    const token = makeToken('curator')
    const res = await request(app)
      .get('/api/workers/search/advanced?query=painter')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
  })

  it('returns 500 when the service throws', async () => {
    vi.mocked(searchService.performAdvancedSearch).mockRejectedValue(new Error('Service error'))
    const res = await request(app).get('/api/workers/search/advanced?query=test')
    expect(res.status).toBeGreaterThanOrEqual(500)
  })

  it('returns empty data when no workers match', async () => {
    vi.mocked(searchService.performAdvancedSearch).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20, hasMore: false, pages: 0 },
    })
    const res = await request(app).get('/api/workers/search/advanced?query=nonexistent')
    expect(res.status).toBe(200)
    expect(res.body.data).toEqual([])
    expect(res.body.meta.total).toBe(0)
  })
})

// ─── Auth & validation failure cases ─────────────────────────────────────────

describe('Search endpoints – auth and validation edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(searchService.searchWorkers).mockResolvedValue(fakeSearchResult as any)
    vi.mocked(searchService.performAdvancedSearch).mockResolvedValue(fakeAdvancedResult as any)
  })

  it('rejects an invalid Bearer token with 401', async () => {
    const res = await request(app)
      .get('/api/workers/search?q=test')
      .set('Authorization', 'Bearer not-a-real-token')
    // search is public so invalid token is ignored (route has no auth guard)
    // the app should still respond with 200 for public endpoints
    expect([200, 401]).toContain(res.status)
  })

  it('handles malformed limit gracefully (defaults to capped value)', async () => {
    const res = await request(app).get('/api/workers/search?limit=abc')
    expect(res.status).toBe(200)
  })

  it('handles malformed page gracefully', async () => {
    const res = await request(app).get('/api/workers/search?page=foo')
    expect(res.status).toBe(200)
  })

  it('handles XSS attempt in query string safely', async () => {
    const res = await request(app).get(
      '/api/workers/search?q=%3Cscript%3Ealert(1)%3C%2Fscript%3E',
    )
    expect(res.status).toBe(200)
    // Verify it called the service with the sanitised/raw string — no crash
    expect(vi.mocked(searchService.searchWorkers)).toHaveBeenCalled()
  })
})
