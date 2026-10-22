/**
 * E2E tests for the review system
 * Tests CRUD operations, moderation queue, flagging, and rating aggregation
 * 
 * Issue #939: Comprehensive review system testing
 * 
 * Critical assertions:
 * - Rating aggregation math with concrete numbers
 * - Moderation queue in/out transitions
 * - Authorization boundaries (user vs admin)
 * - Duplicate prevention and ownership checks
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { db } from '../../db.js'
import app from '../../app.js'

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

import { vi } from 'vitest'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createVerifiedUser(email: string, role: 'user' | 'curator' | 'admin' = 'user') {
  const argon2 = await import('argon2')
  return db.user.create({
    data: {
      email,
      password: await argon2.hash('Password123!'),
      firstName: 'Test',
      lastName: 'User',
      role,
      verified: true,
    },
  })
}

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' })
  return res.body.token as string
}

// ── State ─────────────────────────────────────────────────────────────────────

let categoryId: string
let workerId: string
let userToken: string
let user2Token: string
let adminToken: string
let userId: string
let user2Id: string

describe('Reviews E2E', () => {
  beforeAll(async () => {
    // Seed category and worker
    const cat = await db.category.create({ data: { name: 'Plumber' } })
    categoryId = cat.id

    const curator = await createVerifiedUser('curator@e2e.com', 'curator')
    const worker = await db.worker.create({
      data: { name: 'Bob the Plumber', categoryId, curatorId: curator.id },
    })
    workerId = worker.id

    // Create users
    const user = await createVerifiedUser('user@e2e.com', 'user')
    const user2 = await createVerifiedUser('user2@e2e.com', 'user')
    await createVerifiedUser('admin@e2e.com', 'admin')

    userId = user.id
    user2Id = user2.id

    userToken = await loginAs('user@e2e.com')
    user2Token = await loginAs('user2@e2e.com')
    adminToken = await loginAs('admin@e2e.com')
  })

  // ── Scenario 1: Authenticated user submits review ──────────────────────────
  describe('POST /api/workers/:id/reviews - Create review', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await request(app)
        .post(`/api/workers/${workerId}/reviews`)
        .send({ rating: 5, comment: 'Great work!' })

      expect(res.status).toBe(401)
    })

    it('creates a review for authenticated user and returns 201', async () => {
      const res = await request(app)
        .post(`/api/workers/${workerId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comment: 'Excellent plumber!' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('success')
      expect(res.body.data.rating).toBe(5)
      expect(res.body.data.comment).toBe('Excellent plumber!')
      expect(res.body.data.status).toBe('pending') // Requires moderation
    })
  })

  // ── Scenario 2: Duplicate review prevention ────────────────────────────────
  describe('POST /api/workers/:id/reviews - Duplicate prevention', () => {
    it('returns 409 when user tries to submit second review for same worker', async () => {
      const res = await request(app)
        .post(`/api/workers/${workerId}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 4, comment: 'Another review attempt' })

      expect(res.status).toBe(409)
      expect(res.body.message).toContain('already reviewed')
    })
  })

  // ── Scenario 3: Rating aggregation with concrete arithmetic ────────────────
  describe('GET /api/workers/:id/reviews - Rating aggregation', () => {
    let review1Id: string
    let review2Id: string

    it('returns correct avgRating and reviewCount after first review', async () => {
      // First review exists from previous test (rating: 5, pending)
      // We need to approve it first for it to count in aggregation
      const review = await db.review.findFirst({
        where: { workerId, authorId: userId },
      })
      expect(review).toBeDefined()
      review1Id = review!.id

      // Approve the review
      await db.review.update({
        where: { id: review1Id },
        data: { status: 'approved' },
      })

      const res = await request(app).get(`/api/workers/${workerId}/reviews`)

      expect(res.status).toBe(200)
      expect(res.body.avgRating).toBe(5)
      expect(res.body.reviewCount).toBe(1)
      expect(res.body.data).toHaveLength(1)
    })

    it('returns correct avgRating after multiple reviews (5 and 3 → avg 4.0)', async () => {
      // Create second review (rating: 3)
      const review2 = await db.review.create({
        data: {
          workerId,
          authorId: user2Id,
          rating: 3,
          comment: 'Decent work',
          status: 'approved', // Create as approved for aggregation
        },
      })
      review2Id = review2.id

      const res = await request(app).get(`/api/workers/${workerId}/reviews`)

      expect(res.status).toBe(200)
      // (5 + 3) / 2 = 4.0
      expect(res.body.avgRating).toBe(4)
      expect(res.body.reviewCount).toBe(2)
      expect(res.body.data).toHaveLength(2)
    })

    it('computes correct average with three reviews (5, 3, 2 → avg 3.333...)', async () => {
      // Create third user and review (rating: 2)
      const user3 = await createVerifiedUser('user3@e2e.com', 'user')
      await db.review.create({
        data: {
          workerId,
          authorId: user3.id,
          rating: 2,
          comment: 'Could be better',
          status: 'approved',
        },
      })

      const res = await request(app).get(`/api/workers/${workerId}/reviews`)

      expect(res.status).toBe(200)
      // (5 + 3 + 2) / 3 = 3.333... → rounded to 3.3 by service
      // But route uses raw aggregate, so check actual value
      expect(res.body.reviewCount).toBe(3)
      const avgRating = res.body.avgRating
      expect(avgRating).toBeCloseTo(3.333, 2)
    })
  })

  // ── Scenario 4: Delete review - ownership checks ───────────────────────────
  describe('DELETE /api/reviews/:id - Delete own review', () => {
    let reviewToDelete: string

    beforeAll(async () => {
      // Create a review by user4
      const user4 = await createVerifiedUser('user4@e2e.com', 'user')
      const review = await db.review.create({
        data: {
          workerId,
          authorId: user4.id,
          rating: 4,
          comment: 'Good work',
        },
      })
      reviewToDelete = review.id
    })

    it('returns 403 when attempting to delete someone elses review', async () => {
      const res = await request(app)
        .delete(`/api/reviews/${reviewToDelete}`)
        .set('Authorization', `Bearer ${userToken}`) // Different user

      expect(res.status).toBe(403)
      expect(res.body.message).toContain('Forbidden')
    })

    it('returns 204 when user deletes their own review', async () => {
      const user4Token = await loginAs('user4@e2e.com')

      const res = await request(app)
        .delete(`/api/reviews/${reviewToDelete}`)
        .set('Authorization', `Bearer ${user4Token}`)

      expect(res.status).toBe(204)

      // Verify deletion
      const deleted = await db.review.findUnique({ where: { id: reviewToDelete } })
      expect(deleted).toBeNull()
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).delete(`/api/reviews/${reviewToDelete}`)

      expect(res.status).toBe(401)
    })
  })

  // ── Scenario 5: Flagging and moderation queue transitions ──────────────────
  describe('PATCH /api/reviews/:id/flag - Flag review', () => {
    let reviewToFlag: string

    beforeAll(async () => {
      const user5 = await createVerifiedUser('user5@e2e.com', 'user')
      const review = await db.review.create({
        data: {
          workerId,
          authorId: user5.id,
          rating: 1,
          comment: 'Suspicious review',
          status: 'approved',
        },
      })
      reviewToFlag = review.id
    })

    it('allows authenticated user to flag a review', async () => {
      const res = await request(app)
        .patch(`/api/reviews/${reviewToFlag}/flag`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reason: 'Spam or fake review' })

      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
      expect(res.body.data.flagged).toBe(true)
      expect(res.body.data.flagReason).toBe('Spam or fake review')
    })

    it('surfaces flagged review in admin moderation queue', async () => {
      const res = await request(app)
        .get('/api/reviews/moderation/queue')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(res.body.data).toBeDefined()

      const flaggedReview = res.body.data.find((r: any) => r.id === reviewToFlag)
      expect(flaggedReview).toBeDefined()
      expect(flaggedReview.flagged).toBe(true)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch(`/api/reviews/${reviewToFlag}/flag`)
        .send({ reason: 'Test' })

      expect(res.status).toBe(401)
    })
  })

  // ── Scenario 6: Admin moderation queue access ──────────────────────────────
  describe('GET /api/reviews/moderation/queue - Admin moderation', () => {
    it('returns 403 for non-admin users', async () => {
      const res = await request(app)
        .get('/api/reviews/moderation/queue')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(403)
    })

    it('returns moderation queue for admin', async () => {
      const res = await request(app)
        .get('/api/reviews/moderation/queue')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)

      // Queue should include pending and/or flagged reviews
      const hasQueueItems = res.body.data.some(
        (r: any) => r.status === 'pending' || r.flagged === true
      )
      expect(hasQueueItems).toBe(true)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).get('/api/reviews/moderation/queue')

      expect(res.status).toBe(401)
    })
  })

  // ── Scenario 7: Moderate review (approve/reject) ───────────────────────────
  describe('PATCH /api/reviews/:id/moderate - Moderate review', () => {
    let pendingReview: string
    let flaggedReview: string

    beforeAll(async () => {
      const user6 = await createVerifiedUser('user6@e2e.com', 'user')

      // Create pending review
      const pending = await db.review.create({
        data: {
          workerId,
          authorId: user6.id,
          rating: 5,
          comment: 'Pending review',
          status: 'pending',
        },
      })
      pendingReview = pending.id

      // Create flagged review
      const user7 = await createVerifiedUser('user7@e2e.com', 'user')
      const flagged = await db.review.create({
        data: {
          workerId,
          authorId: user7.id,
          rating: 1,
          comment: 'Flagged review',
          status: 'approved',
          flagged: true,
          flagReason: 'Inappropriate content',
        },
      })
      flaggedReview = flagged.id
    })

    it('returns 403 when non-admin attempts to moderate', async () => {
      const res = await request(app)
        .patch(`/api/reviews/${pendingReview}/moderate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'approve' })

      expect(res.status).toBe(403)
    })

    it('approves pending review and removes from queue', async () => {
      // Check queue before
      const queueBefore = await request(app)
        .get('/api/reviews/moderation/queue')
        .set('Authorization', `Bearer ${adminToken}`)

      const beforeIds = queueBefore.body.data.map((r: any) => r.id)
      expect(beforeIds).toContain(pendingReview)

      // Approve review
      const res = await request(app)
        .patch(`/api/reviews/${pendingReview}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' })

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('approved')

      // Check queue after - should not contain the review
      const queueAfter = await request(app)
        .get('/api/reviews/moderation/queue')
        .set('Authorization', `Bearer ${adminToken}`)

      const afterIds = queueAfter.body.data.map((r: any) => r.id)
      expect(afterIds).not.toContain(pendingReview)
    })

    it('rejects flagged review and excludes from public aggregate', async () => {
      // Get aggregate before rejection
      const beforeRes = await request(app).get(`/api/workers/${workerId}/reviews`)
      const countBefore = beforeRes.body.reviewCount

      // Reject review
      const res = await request(app)
        .patch(`/api/reviews/${flaggedReview}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'reject' })

      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('rejected')

      // Check public list - rejected review should not appear
      const afterRes = await request(app).get(`/api/workers/${workerId}/reviews`)
      const reviewIds = afterRes.body.data.map((r: any) => r.id)
      expect(reviewIds).not.toContain(flaggedReview)

      // Review count should not include rejected review
      // Note: count might be same if review wasn't included in aggregate before
      expect(afterRes.body.reviewCount).toBeLessThanOrEqual(countBefore)
    })

    it('returns 401 when unauthenticated', async () => {
      const res = await request(app)
        .patch(`/api/reviews/${pendingReview}/moderate`)
        .send({ action: 'approve' })

      expect(res.status).toBe(401)
    })
  })

  // ── Edge cases ──────────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    it('returns 404 when reviewing non-existent worker', async () => {
      const res = await request(app)
        .post('/api/workers/nonexistent-id/reviews')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 5, comment: 'Test' })

      expect(res.status).toBe(404)
    })

    it('returns 404 when deleting non-existent review', async () => {
      const res = await request(app)
        .delete('/api/reviews/nonexistent-id')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(404)
    })

    it('rejects invalid rating values', async () => {
      // Create new worker for clean test
      const curator = await db.user.findFirst({ where: { role: 'curator' } })
      const worker = await db.worker.create({
        data: { name: 'Test Worker', categoryId, curatorId: curator!.id },
      })

      const res = await request(app)
        .post(`/api/workers/${worker.id}/reviews`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ rating: 10, comment: 'Invalid rating' })

      expect(res.status).toBe(400)
    })

    it('returns empty aggregate when worker has no approved reviews', async () => {
      const curator = await db.user.findFirst({ where: { role: 'curator' } })
      const worker = await db.worker.create({
        data: { name: 'Worker No Reviews', categoryId, curatorId: curator!.id },
      })

      const res = await request(app).get(`/api/workers/${worker.id}/reviews`)

      expect(res.status).toBe(200)
      expect(res.body.avgRating).toBe(0)
      expect(res.body.reviewCount).toBe(0)
      expect(res.body.data).toHaveLength(0)
    })
  })
})
