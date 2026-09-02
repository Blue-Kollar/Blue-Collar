import request from 'supertest'
import { afterAll,beforeAll, describe, expect, it } from 'vitest'

import { app } from '../app.js'
import { db } from '../db.js'

describe('Reviews & Ratings API (Issue #750)', () => {
  let userToken: string
  let workerId: string
  let reviewId: string

  beforeAll(async () => {
    // Create test user
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        email: `review-test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
        firstName: 'Review',
        lastName: 'Tester',
      })

    // Verify account
    const user = await db.user.findUnique({
      where: { email: `review-test-${Date.now()}@example.com` },
    })
    await db.user.update({
      where: { id: user!.id },
      data: { verified: true, walletAddress: 'GBU7VFGU2QMYMBPHTYVGNBMVR4X3KBVJX3VMFKJ2J53M6L4PXEQ46WT' },
    })

    // Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: `review-test-${Date.now()}@example.com`,
        password: 'SecurePassword123!',
      })

    userToken = loginRes.body.token

    // Create test worker
    const curatorUser = await db.user.create({
      data: {
        email: `curator-${Date.now()}@example.com`,
        password: 'hash',
        firstName: 'Curator',
        lastName: 'Test',
        role: 'curator',
        verified: true,
        walletAddress: 'GBU7VFGU2QMYMBPHTYVGNBMVR4X3KBVJX3VMFKJ2J53M6L4PXEQ46WT',
      },
    })

    const category = await db.category.create({
      data: { name: `Category${Date.now()}`, description: 'Test' },
    })

    const worker = await db.worker.create({
      data: {
        name: 'Test Worker',
        curatorId: curatorUser.id,
        categoryId: category.id,
        isActive: true,
        walletAddress: 'GBU7VFGU2QMYMBPHTYVGNBMVR4X3KBVJX3VMFKJ2J53M6L4PXEQ46WT',
      },
    })

    workerId = worker.id
  })

  it('should create a review with verification', async () => {
    const res = await request(app)
      .post(`/api/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        workerId,
        rating: 5,
        comment: 'Great service!',
      })

    expect(res.status).toBe(201)
    expect(res.body.data).toHaveProperty('id')
    expect(res.body.data.isVerified).toBe(true)
    reviewId = res.body.data.id
  })

  it('should list reviews with aggregation', async () => {
    const res = await request(app)
      .get(`/api/reviews?workerId=${workerId}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toBeInstanceOf(Array)
    expect(res.body.stats).toHaveProperty('averageRating')
    expect(res.body.stats).toHaveProperty('reviewCount')
    expect(res.body.stats).toHaveProperty('distribution')
    expect(res.body.stats).toHaveProperty('verified')
  })

  it('should flag a review', async () => {
    const res = await request(app)
      .patch(`/api/reviews/${reviewId}/flag`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'Inappropriate content' })

    expect(res.status).toBe(200)
    expect(res.body.data.flagged).toBe(true)
    expect(res.body.data.flagReason).toBe('Inappropriate content')
  })

  it('should prevent duplicate reviews', async () => {
    const res = await request(app)
      .post(`/api/reviews`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        workerId,
        rating: 4,
        comment: 'Duplicate review',
      })

    expect(res.status).toBe(409)
    expect(res.body.message).toContain('already reviewed')
  })

  it('should show rating distribution', async () => {
    // Create multiple reviews with different ratings
    for (let i = 0; i < 3; i++) {
      const user = await db.user.create({
        data: {
          email: `user-${i}-${Date.now()}@example.com`,
          password: 'hash',
          firstName: `User${i}`,
          lastName: 'Test',
          verified: true,
          walletAddress: 'GBU7VFGU2QMYMBPHTYVGNBMVR4X3KBVJX3VMFKJ2J53M6L4PXEQ46WT',
        },
      })

      await db.review.create({
        data: {
          workerId,
          authorId: user.id,
          rating: (i + 1) * 2,
          comment: `Rating ${(i + 1) * 2}`,
          isVerified: true,
          status: 'approved',
        },
      })
    }

    const res = await request(app)
      .get(`/api/reviews?workerId=${workerId}`)

    expect(res.body.stats.distribution).toHaveLength(5)
    expect(res.body.stats.distribution[0]).toHaveProperty('rating')
    expect(res.body.stats.distribution[0]).toHaveProperty('count')
    expect(res.body.stats.distribution[0]).toHaveProperty('percentage')
  })

  afterAll(async () => {
    // Cleanup
    await db.review.deleteMany({ where: { workerId } })
    await db.worker.deleteMany({ where: { id: workerId } })
    await db.user.deleteMany({ where: { email: { contains: 'review-test' } } })
    await db.user.deleteMany({ where: { email: { contains: 'curator-' } } })
    await db.user.deleteMany({ where: { email: { contains: 'user-' } } })
  })
})
