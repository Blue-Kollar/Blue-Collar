/**
 * Integration tests for reviews endpoints — packages/api/src/__tests__/integration/reviews.test.ts
 *
 * Exercises the full HTTP stack (route → controller → service) while mocking
 * the database and mailer to keep tests fast and deterministic.
 *
 * Issue: #1005 [Backend] Add integration tests for reviews endpoints
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import express from 'express'

// ─── Env setup ────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-reviews-secret'
process.env.APP_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    worker: {
      findUnique: vi.fn(),
    },
    review: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-reviews-secret',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'test-user',
    MAIL_PASS: 'test-pass',
    APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'test' }) },
}))

vi.mock('../../mailer/index.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendModerationEmail: vi.fn().mockResolvedValue(undefined),
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { db } from '../../db.js'
import reviewRoutes from '../../routes/reviews.js'

// Build a minimal express app for reviews endpoints only
function buildApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/workers/:workerId/reviews', reviewRoutes)
  app.use('/api/reviews', reviewRoutes)
  return app
}

const testApp = buildApp()

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authToken(userId = 'user-1', role = 'user') {
  return jwt.sign({ id: userId, role }, 'test-reviews-secret', { expiresIn: '1h' })
}

function makeReview(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    workerId: 'worker-1',
    userId: 'user-1',
    authorId: 'user-1',
    rating: 5,
    body: 'Excellent service!',
    comment: 'Excellent service!',
    status: 'approved',
    flagged: false,
    flagReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    author: { id: 'user-1', firstName: 'Alice', lastName: 'Smith', avatar: null },
    ...overrides,
  }
}

// ─── GET /api/workers/:workerId/reviews ───────────────────────────────────────

describe('GET /api/workers/:workerId/reviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with reviews and aggregate stats', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([
      makeReview({ rating: 5 }),
      makeReview({ id: 'review-2', rating: 4 }),
    ] as never)
    vi.mocked(db.review.aggregate).mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    } as never)

    const res = await request(testApp).get('/api/workers/worker-1/reviews')

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(2)
    expect(res.body.avgRating).toBe(4.5)
    expect(res.body.reviewCount).toBe(2)
  })

  it('returns 200 with empty array when no reviews exist', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([] as never)
    vi.mocked(db.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    } as never)

    const res = await request(testApp).get('/api/workers/worker-1/reviews')

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
    expect(res.body.avgRating).toBe(0)
    expect(res.body.reviewCount).toBe(0)
  })

  it('is a public endpoint (no auth required)', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([] as never)
    vi.mocked(db.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    } as never)

    const res = await request(testApp).get('/api/workers/worker-1/reviews')
    expect(res.status).not.toBe(401)
  })
})

// ─── POST /api/workers/:workerId/reviews ──────────────────────────────────────

describe('POST /api/workers/:workerId/reviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 when review is created successfully', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1', name: 'Bob' } as never)
    vi.mocked(db.review.create).mockResolvedValue(makeReview() as never)

    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ rating: 5, body: 'Excellent service!' })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    expect(res.body.code).toBe(201)
    expect(res.body.data.rating).toBe(5)
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workerId: 'worker-1',
        authorId: 'user-1',
        userId: 'user-1',
        rating: 5,
      }),
    }))
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .send({ rating: 5, body: 'Excellent service!' })

    expect(res.status).toBe(401)
  })

  it('returns 404 when worker does not exist', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null as never)

    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ rating: 5, body: 'Excellent service!' })

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/worker not found/i)
  })

  it('returns 400 for rating below 1', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)

    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ rating: 0, body: 'Some review' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/rating/i)
  })

  it('returns 400 for rating above 5', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)

    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ rating: 6, body: 'Too high' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when body is missing', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)

    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ rating: 4 })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/body is required/i)
  })

  it('returns 409 for duplicate review (same user + worker)', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)
    vi.mocked(db.review.create).mockRejectedValue({ code: 'P2002' })

    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ rating: 5, body: 'Already reviewed' })

    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/already reviewed/i)
  })

  it('flags spam reviews and still returns 201', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)
    vi.mocked(db.review.create).mockResolvedValue(makeReview({ flagged: true }) as never)

    const res = await request(testApp)
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ rating: 5, body: 'click here for discount money fast' })

    expect(res.status).toBe(201)
    // Spam detection should set flagged = true
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ flagged: true }),
    }))
  })
})

// ─── DELETE /api/reviews/:id ──────────────────────────────────────────────────

describe('DELETE /api/reviews/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 204 when review owner deletes their review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(
      makeReview({ userId: 'user-1', authorId: 'user-1' }) as never,
    )
    vi.mocked(db.review.delete).mockResolvedValue(makeReview() as never)

    const res = await request(testApp)
      .delete('/api/reviews/review-1')
      .set('Authorization', `Bearer ${authToken('user-1')}`)

    expect(res.status).toBe(204)
    expect(db.review.delete).toHaveBeenCalledWith({ where: { id: 'review-1' } })
  })

  it('returns 403 when a different user tries to delete', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(
      makeReview({ userId: 'user-2', authorId: 'user-2' }) as never,
    )

    const res = await request(testApp)
      .delete('/api/reviews/review-1')
      .set('Authorization', `Bearer ${authToken('user-1')}`)

    expect(res.status).toBe(403)
    expect(db.review.delete).not.toHaveBeenCalled()
  })

  it('returns 404 when review does not exist', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never)

    const res = await request(testApp)
      .delete('/api/reviews/nonexistent-id')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(testApp).delete('/api/reviews/review-1')

    expect(res.status).toBe(401)
  })
})

// ─── PATCH /api/reviews/:id/flag ─────────────────────────────────────────────

describe('PATCH /api/reviews/:id/flag', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 when review is flagged successfully', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(makeReview() as never)
    vi.mocked(db.review.update).mockResolvedValue(
      makeReview({ flagged: true, flagReason: 'inappropriate', status: 'pending' }) as never,
    )

    const res = await request(testApp)
      .patch('/api/reviews/review-1/flag')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ reason: 'inappropriate' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.flagged).toBe(true)
  })

  it('returns 200 when flagged without a reason', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(makeReview() as never)
    vi.mocked(db.review.update).mockResolvedValue(makeReview({ flagged: true }) as never)

    const res = await request(testApp)
      .patch('/api/reviews/review-1/flag')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({})

    expect(res.status).toBe(200)
  })

  it('returns 404 when review does not exist', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never)

    const res = await request(testApp)
      .patch('/api/reviews/nonexistent/flag')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ reason: 'spam' })

    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(testApp)
      .patch('/api/reviews/review-1/flag')
      .send({ reason: 'spam' })

    expect(res.status).toBe(401)
  })
})

// ─── GET /api/reviews/moderation/queue (admin) ────────────────────────────────

describe('GET /api/reviews/moderation/queue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with pending/flagged reviews for admin', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([
      makeReview({ status: 'pending' }),
      makeReview({ id: 'review-2', flagged: true }),
    ] as never)

    const res = await request(testApp)
      .get('/api/reviews/moderation/queue')
      .set('Authorization', `Bearer ${authToken('admin-1', 'admin')}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(2)
  })

  it('returns 403 when a non-admin user tries to access the queue', async () => {
    const res = await request(testApp)
      .get('/api/reviews/moderation/queue')
      .set('Authorization', `Bearer ${authToken('user-1', 'user')}`)

    expect(res.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(testApp).get('/api/reviews/moderation/queue')

    expect(res.status).toBe(401)
  })
})

// ─── PATCH /api/reviews/:id/moderate (admin) ──────────────────────────────────

describe('PATCH /api/reviews/:id/moderate', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 when admin approves a review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(
      makeReview({ status: 'pending', author: { email: 'user@test.com', firstName: 'Alice' } }) as never,
    )
    vi.mocked(db.review.update).mockResolvedValue(makeReview({ status: 'approved' }) as never)

    const res = await request(testApp)
      .patch('/api/reviews/review-1/moderate')
      .set('Authorization', `Bearer ${authToken('admin-1', 'admin')}`)
      .send({ action: 'approve' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.status).toBe('approved')
  })

  it('returns 200 when admin rejects a review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(
      makeReview({ status: 'pending', author: { email: 'user@test.com', firstName: 'Bob' } }) as never,
    )
    vi.mocked(db.review.update).mockResolvedValue(makeReview({ status: 'rejected' }) as never)

    const res = await request(testApp)
      .patch('/api/reviews/review-1/moderate')
      .set('Authorization', `Bearer ${authToken('admin-1', 'admin')}`)
      .send({ action: 'reject' })

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('rejected')
  })

  it('returns 400 for an invalid action', async () => {
    const res = await request(testApp)
      .patch('/api/reviews/review-1/moderate')
      .set('Authorization', `Bearer ${authToken('admin-1', 'admin')}`)
      .send({ action: 'delete' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/action must be approve or reject/i)
  })

  it('returns 404 when review does not exist', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never)

    const res = await request(testApp)
      .patch('/api/reviews/nonexistent/moderate')
      .set('Authorization', `Bearer ${authToken('admin-1', 'admin')}`)
      .send({ action: 'approve' })

    expect(res.status).toBe(404)
  })

  it('returns 403 when a non-admin user tries to moderate', async () => {
    const res = await request(testApp)
      .patch('/api/reviews/review-1/moderate')
      .set('Authorization', `Bearer ${authToken('user-1', 'user')}`)
      .send({ action: 'approve' })

    expect(res.status).toBe(403)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(testApp)
      .patch('/api/reviews/review-1/moderate')
      .send({ action: 'approve' })

    expect(res.status).toBe(401)
  })
})
