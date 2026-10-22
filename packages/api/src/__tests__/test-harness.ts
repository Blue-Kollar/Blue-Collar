/**
 * Shared harness for HTTP integration suites (#1598).
 *
 * Every suite that drives the real Express app through supertest needs the
 * same environment and the same infrastructure stubs (Redis, config, mailer,
 * rate limiters, passport, request logging, event bus). This module holds
 * those once so a suite only declares the mocks that are specific to it,
 * usually its database model stubs.
 *
 * Usage (the harness must be imported before `app`, so the environment is in
 * place when the config module loads):
 *
 *   import { makeAuthToken, infraMocks } from '../test-harness.js'
 *
 *   vi.mock('../../config/redis.js', async () => (await import('../test-harness.js')).infraMocks.redis())
 *   vi.mock('../../config/env.js', async () => (await import('../test-harness.js')).infraMocks.env())
 *   // ...one line per entry in `infraMocks`, then the suite's own db mock
 *
 *   import app from '../../app.js'
 *
 * See `./README.md` for the full list and guidance.
 */
import { vi } from 'vitest'
import jwt from 'jsonwebtoken'

// ─── Environment ─────────────────────────────────────────────────────────────

export const TEST_JWT_SECRET = 'test-integration-secret'

/** Every variable `config/config.ts` requires at load time, set to test values. */
export const TEST_ENV: Record<string, string> = {
  NODE_ENV: 'test',
  JWT_SECRET: TEST_JWT_SECRET,
  DATABASE_URL: 'postgresql://localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  APP_URL: 'http://localhost:3000',
  GOOGLE_CLIENT_ID: 'test',
  GOOGLE_CLIENT_SECRET: 'test',
  MAIL_HOST: 'smtp.test.local',
  MAIL_PORT: '587',
  MAIL_USER: 'test',
  MAIL_PASS: 'test',
}

for (const [key, value] of Object.entries(TEST_ENV)) {
  process.env[key] ??= value
}

// ─── Auth ────────────────────────────────────────────────────────────────────

/** Sign a JWT the app's `authenticate` middleware accepts in tests. */
export function makeAuthToken(role = 'USER', id = 'user-1', email = 'test@example.com') {
  return jwt.sign({ id, email, role }, TEST_JWT_SECRET, { expiresIn: '1h' })
}

// ─── Infrastructure mock factories ───────────────────────────────────────────
//
// Each factory returns the module shape the real module exports. They are
// pure (no vi.mock calls inside), so a suite wires them up with vi.mock and
// can override any of them for a single test if needed.

export const infraMocks = {
  redis: () => ({
    redis: {
      connect: vi.fn().mockResolvedValue(undefined),
      ping: vi.fn().mockResolvedValue('PONG'),
      // Cache middleware: misses by default, so handlers run against the DB mocks.
      get: vi.fn().mockResolvedValue(null),
      setex: vi.fn().mockResolvedValue('OK'),
      del: vi.fn().mockResolvedValue(0),
      // BullMQ reads these when the queue module loads.
      options: { host: 'localhost', port: 6379 },
    },
    cacheMetrics: { hits: 0, misses: 0 },
  }),

  env: () => ({
    env: {
      DATABASE_URL: TEST_ENV.DATABASE_URL,
      JWT_SECRET: TEST_JWT_SECRET,
      PORT: 3000,
      GOOGLE_CLIENT_ID: TEST_ENV.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: TEST_ENV.GOOGLE_CLIENT_SECRET,
      MAIL_HOST: TEST_ENV.MAIL_HOST,
      MAIL_PORT: 587,
      MAIL_USER: TEST_ENV.MAIL_USER,
      MAIL_PASS: TEST_ENV.MAIL_PASS,
      APP_URL: TEST_ENV.APP_URL,
    },
  }),

  openapiDocs: () => {
    // Pass-through router-like stub: every method just advances the chain.
    const passThrough = (_req: unknown, _res: unknown, next: () => void) => next()
    const fn = Object.assign(passThrough, { use: passThrough, get: passThrough, handle: passThrough })
    return { default: fn }
  },

  passport: () => ({
    default: {
      initialize: () => (_req: unknown, _res: unknown, next: () => void) => next(),
      authenticate: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    },
  }),

  requestLogger: () => ({
    requestLogger: (_req: unknown, _res: unknown, next: () => void) => next(),
  }),

  events: () => ({ registerEventHandlers: vi.fn() }),

  // BullMQ queues open Redis connections when the module loads; stub them all.
  queue: () => {
    const fakeQueue = () => ({ add: vi.fn().mockResolvedValue({ id: 'job-1' }), close: vi.fn() })
    return {
      emailQueue: fakeQueue(),
      notificationQueue: fakeQueue(),
      indexerQueue: fakeQueue(),
      ttlQueue: fakeQueue(),
      cleanupQueue: fakeQueue(),
      schedulerQueue: fakeQueue(),
      enqueueEmail: vi.fn().mockResolvedValue({ id: 'job-1' }),
      enqueueNotification: vi.fn().mockResolvedValue({ id: 'job-1' }),
      enqueueScheduled: vi.fn().mockResolvedValue({ id: 'job-1' }),
    }
  },

  rateLimiter: () => ({
    moderateAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
    strictAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
    publicReadRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
    publicWriteRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  }),

  versionRateLimit: () => ({
    versionRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    getDynamicRateLimitConfig: () => ({}),
    getRateLimitStatus: (_req: unknown, res: { json: (body: unknown) => void }) =>
      res.json({ status: 'ok' }),
  }),

  userRateLimit: () => ({
    contactRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
    generalRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
    userRateLimit: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),

  mailerTransport: () => ({
    transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg' }) },
  }),
}
