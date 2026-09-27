import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import reviewRoutes from '../routes/reviews.js'

process.env.JWT_SECRET = 'test-secret'

vi.mock('../db.js', () => ({
  db: {
    worker: { findUnique: vi.fn() },
    review: {
      aggregate: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

vi.mock('../config/env.js', () => ({
  env: { JWT_SECRET: 'test-secret' },
}))

vi.mock('../mailer/index.js', () => ({
  sendModerationEmail: vi.fn(),
}))

import { db } from '../db.js'

function app() {
  const instance = express()
  instance.use(express.json())
  instance.use('/api/workers/:workerId/reviews', reviewRoutes)
  instance.use('/api/reviews', reviewRoutes)
  return instance
}

function token(userId = 'user-1', role = 'user') {
  return jwt.sign({ id: userId, role }, 'test-secret')
}

describe('review routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('lists worker reviews with aggregate rating', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([{ id: 'review-1', rating: 5 }] as never)
    vi.mocked(db.review.aggregate).mockResolvedValue({
      _avg: { rating: 5 },
      _count: { rating: 1 },
    } as never)

    const res = await request(app()).get('/api/workers/worker-1/reviews')

    expect(res.status).toBe(200)
    expect(res.body.avgRating).toBe(5)
    expect(res.body.reviewCount).toBe(1)
    expect(res.body.data).toHaveLength(1)
  })

  it('requires auth to create a review', async () => {
    const res = await request(app())
      .post('/api/workers/worker-1/reviews')
      .send({ rating: 5, body: 'Great work' })

    expect(res.status).toBe(401)
  })

  it('creates a review with rating validation', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)
    vi.mocked(db.review.create).mockResolvedValue({
      id: 'review-1',
      workerId: 'worker-1',
      userId: 'user-1',
      authorId: 'user-1',
      rating: 5,
      body: 'Great work',
    } as never)

    const res = await request(app())
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${token()}`)
      .send({ rating: 5, body: 'Great work' })

    expect(res.status).toBe(201)
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: 'user-1', workerId: 'worker-1', rating: 5 }),
    }))
  })

  it('rejects review with rating out of range', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)

    const res = await request(app())
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${token()}`)
      .send({ rating: 6, body: 'Great work' })

    expect(res.status).toBe(400)
  })

  it('rejects review with missing body', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)

    const res = await request(app())
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${token()}`)
      .send({ rating: 5 })

    expect(res.status).toBe(400)
  })

  it('rejects duplicate reviews', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)
    vi.mocked(db.review.create).mockRejectedValue({ code: 'P2002' } as never)

    const res = await request(app())
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${token()}`)
      .send({ rating: 5, body: 'Great work' })

    expect(res.status).toBe(409)
  })

  it('returns 404 for review on non-existent worker', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null as never)

    const res = await request(app())
      .post('/api/workers/worker-1/reviews')
      .set('Authorization', `Bearer ${token()}`)
      .send({ rating: 5, body: 'Great work' })

    expect(res.status).toBe(404)
  })

  it('allows only the owner to delete a review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ id: 'review-1', userId: 'user-1', authorId: 'user-1' } as never)
    vi.mocked(db.review.delete).mockResolvedValue({ id: 'review-1' } as never)

    const res = await request(app())
      .delete('/api/reviews/review-1')
      .set('Authorization', `Bearer ${token('user-1')}`)

    expect(res.status).toBe(204)
    expect(db.review.delete).toHaveBeenCalledWith({ where: { id: 'review-1' } })
  })

  it('forbids deleting another user review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ id: 'review-1', userId: 'user-2', authorId: 'user-2' } as never)

    const res = await request(app())
      .delete('/api/reviews/review-1')
      .set('Authorization', `Bearer ${token('user-1')}`)

    expect(res.status).toBe(403)
  })

  it('flags a review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ id: 'review-1', status: 'approved' } as never)
    vi.mocked(db.review.update).mockResolvedValue({ id: 'review-1', flagged: true, status: 'pending' } as never)

    const res = await request(app())
      .patch('/api/reviews/review-1/flag')
      .set('Authorization', `Bearer ${token()}`)
      .send({ reason: 'spam' })

    expect(res.status).toBe(200)
    expect(res.body.data.flagged).toBe(true)
  })
})
