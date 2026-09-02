/**
 * Performance regression benchmarks for the BlueCollar API.
 *
 * These tests measure response times for critical endpoints and fail if they
 * exceed defined thresholds. Run with: pnpm vitest run src/__tests__/performance
 *
 * Thresholds are intentionally generous for CI environments (no real DB).
 * In production profiling, tighten these values.
 */

import request from 'supertest'
import { afterAll,beforeAll, describe, expect, it, vi } from 'vitest'

import app from '../../app.js'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    $queryRaw: vi.fn().mockResolvedValue([{ '?column?': 1 }]),
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    worker: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    category: {
      findMany: vi.fn().mockResolvedValue([
        { id: '1', name: 'Plumber', slug: 'plumber' },
        { id: '2', name: 'Electrician', slug: 'electrician' },
      ]),
      findUnique: vi.fn().mockResolvedValue({ id: '1', name: 'Plumber', slug: 'plumber' }),
    },
  },
}))

vi.mock('../../config/redis.js', () => ({
  redis: {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue(undefined),
  },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-secret',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test-id',
    GOOGLE_CLIENT_SECRET: 'test-secret',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'test',
    MAIL_PASS: 'test',
    APP_URL: 'http://localhost:3000',
  },
}))

// ─── Thresholds (ms) ──────────────────────────────────────────────────────────

const THRESHOLDS = {
  health: 200,
  categories: 300,
  workers: 300,
  auth_login: 500,
  cache_metrics: 100,
} as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Measure median response time over `iterations` requests. */
async function measureMedianMs(
  fn: () => Promise<unknown>,
  iterations = 10,
): Promise<number> {
  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    await fn()
    times.push(performance.now() - start)
  }
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Performance benchmarks', () => {
  describe('GET /health', () => {
    it(`responds within ${THRESHOLDS.health}ms (median over 10 requests)`, async () => {
      const median = await measureMedianMs(() => request(app).get('/health'))
      console.log(`  /health median: ${median.toFixed(1)}ms (threshold: ${THRESHOLDS.health}ms)`)
      expect(median).toBeLessThan(THRESHOLDS.health)
    })

    it('returns 200 or 503 (not a crash)', async () => {
      const res = await request(app).get('/health')
      expect([200, 503]).toContain(res.status)
    })
  })

  describe('GET /api/categories', () => {
    it(`responds within ${THRESHOLDS.categories}ms (median over 10 requests)`, async () => {
      const median = await measureMedianMs(() => request(app).get('/api/categories'))
      console.log(`  /api/categories median: ${median.toFixed(1)}ms (threshold: ${THRESHOLDS.categories}ms)`)
      expect(median).toBeLessThan(THRESHOLDS.categories)
    })
  })

  describe('GET /api/workers', () => {
    it(`responds within ${THRESHOLDS.workers}ms (median over 10 requests)`, async () => {
      const median = await measureMedianMs(() => request(app).get('/api/workers'))
      console.log(`  /api/workers median: ${median.toFixed(1)}ms (threshold: ${THRESHOLDS.workers}ms)`)
      expect(median).toBeLessThan(THRESHOLDS.workers)
    })
  })

  describe('POST /api/auth/login', () => {
    it(`responds within ${THRESHOLDS.auth_login}ms (median over 5 requests)`, async () => {
      const median = await measureMedianMs(
        () =>
          request(app)
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password123' }),
        5,
      )
      console.log(`  /api/auth/login median: ${median.toFixed(1)}ms (threshold: ${THRESHOLDS.auth_login}ms)`)
      expect(median).toBeLessThan(THRESHOLDS.auth_login)
    })
  })

  describe('GET /metrics/cache', () => {
    it(`responds within ${THRESHOLDS.cache_metrics}ms`, async () => {
      const start = performance.now()
      await request(app).get('/metrics/cache')
      const elapsed = performance.now() - start
      console.log(`  /metrics/cache: ${elapsed.toFixed(1)}ms (threshold: ${THRESHOLDS.cache_metrics}ms)`)
      expect(elapsed).toBeLessThan(THRESHOLDS.cache_metrics)
    })
  })

  describe('Concurrent request handling', () => {
    it('handles 20 concurrent /health requests without degradation', async () => {
      const concurrency = 20
      const start = performance.now()
      await Promise.all(
        Array.from({ length: concurrency }, () => request(app).get('/health')),
      )
      const total = performance.now() - start
      const perRequest = total / concurrency
      console.log(
        `  ${concurrency} concurrent /health: total=${total.toFixed(1)}ms, per-req=${perRequest.toFixed(1)}ms`,
      )
      // Each request should average under 500ms even under concurrency
      expect(perRequest).toBeLessThan(500)
    })

    it('handles 10 concurrent /api/categories requests', async () => {
      const concurrency = 10
      const start = performance.now()
      await Promise.all(
        Array.from({ length: concurrency }, () => request(app).get('/api/categories')),
      )
      const total = performance.now() - start
      console.log(`  ${concurrency} concurrent /api/categories: total=${total.toFixed(1)}ms`)
      expect(total).toBeLessThan(THRESHOLDS.categories * concurrency)
    })
  })
})
