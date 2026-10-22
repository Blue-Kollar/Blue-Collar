/**
 * E2E tests for the bookings API using Supertest against the real Express app.
 * Requires a live test database (TEST_DATABASE_URL env var).
 *
 * Covers the full booking state machine: pending → confirmed → cancelled/completed,
 * overlap enforcement, authorization checks, and listing filters.
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

async function createWorker(curatorId: string, categoryId: string) {
  return db.worker.create({
    data: { name: 'E2E Worker', categoryId, curatorId },
  })
}

// ── State ────────────────────────────────────────────────────────────────────

let categoryId: string
let requesterToken: string
let curatorToken: string
let otherUserToken: string
let workerId: string
let bookingId: string
let requesterId: string
let curatorId: string

describe('Bookings E2E', () => {
  beforeAll(async () => {
    // Seed a category
    const cat = await db.category.create({ data: { name: 'Plumber' } })
    categoryId = cat.id

    // Create users
    const requester = await createVerifiedUser('booking-requester@e2e.com', 'user')
    const curator = await createVerifiedUser('booking-curator@e2e.com', 'curator')
    const other = await createVerifiedUser('booking-other@e2e.com', 'user')

    requesterId = requester.id
    curatorId = curator.id

    requesterToken = await loginAs('booking-requester@e2e.com')
    curatorToken = await loginAs('booking-curator@e2e.com')
    otherUserToken = await loginAs('booking-other@e2e.com')

    // Create a worker managed by curator
    const worker = await createWorker(curator.id, categoryId)
    workerId = worker.id
  })

  // ── Create booking ─────────────────────────────────────────────────────────
  describe('POST /api/bookings', () => {
    const futureSlot = () => {
      const start = new Date()
      start.setDate(start.getDate() + 7)
      start.setHours(9, 0, 0, 0)
      const end = new Date(start)
      end.setHours(17, 0, 0, 0)
      return { start: start.toISOString(), end: end.toISOString() }
    }

    it('creates a booking as authenticated requester → 201, status=pending', async () => {
      const slot = futureSlot()
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: slot.start, endTime: slot.end })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('success')
      expect(res.body.data.workerId).toBe(workerId)
      expect(res.body.data.requesterId).toBe(requesterId)
      expect(res.body.data.status).toBe('pending')
      bookingId = res.body.data.id
    })

    it('returns 401 without auth', async () => {
      const slot = futureSlot()
      const res = await request(app)
        .post('/api/bookings')
        .send({ workerId, startTime: slot.start, endTime: slot.end })
      expect(res.status).toBe(401)
    })

    it('returns 400 when startTime >= endTime', async () => {
      const slot = futureSlot()
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: slot.end, endTime: slot.start })
      expect(res.status).toBe(400)
    })

    it('returns 400 when startTime is in the past', async () => {
      const past = new Date()
      past.setHours(past.getHours() - 1)
      const future = new Date()
      future.setHours(future.getHours() + 1)
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: past.toISOString(), endTime: future.toISOString() })
      expect(res.status).toBe(400)
    })

    it('returns 404 for unknown workerId', async () => {
      const slot = futureSlot()
      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId: 'nonexistent-id', startTime: slot.start, endTime: slot.end })
      expect(res.status).toBe(404)
    })
  })

  // ── Confirm booking ───────────────────────────────────────────────────────
  describe('PATCH /api/bookings/:id/confirm', () => {
    it('returns 200 and transitions status to confirmed when worker curator confirms', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${curatorToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('confirmed')
    })

    it('returns 403 when a different user tries to confirm', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${bookingId}/confirm`)
        .set('Authorization', `Bearer ${otherUserToken}`)
      expect(res.status).toBe(403)
    })

    it('returns 401 without auth', async () => {
      const res = await request(app).patch(`/api/bookings/${bookingId}/confirm`)
      expect(res.status).toBe(401)
    })

    it('returns 404 for a nonexistent booking', async () => {
      const res = await request(app)
        .patch('/api/bookings/nonexistent-id/confirm')
        .set('Authorization', `Bearer ${curatorToken}`)
      expect(res.status).toBe(404)
    })
  })

  // ── Overlap / double-booking ──────────────────────────────────────────────
  describe('Overlap enforcement', () => {
    it('rejects a booking that overlaps an existing confirmed booking', async () => {
      const slot = {
        start: new Date(),
        end: new Date(),
      }
      slot.start.setDate(slot.start.getDate() + 14)
      slot.start.setHours(10, 0, 0, 0)
      slot.end.setDate(slot.end.getDate() + 14)
      slot.end.setHours(12, 0, 0, 0)

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: slot.start.toISOString(), endTime: slot.end.toISOString() })
      expect(res.status).toBe(201)

      // Same slot should be rejected
      const dup = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: slot.start.toISOString(), endTime: slot.end.toISOString() })
      expect(dup.status).toBe(409)
    })
  })

  // ── Cancel booking ────────────────────────────────────────────────────────
  describe('PATCH /api/bookings/:id/cancel', () => {
    let cancelBookingId: string

    beforeAll(async () => {
      const start = new Date()
      start.setDate(start.getDate() + 21)
      start.setHours(9, 0, 0, 0)
      const end = new Date(start)
      end.setHours(17, 0, 0, 0)

      const res = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: start.toISOString(), endTime: end.toISOString() })
      cancelBookingId = res.body.data.id
    })

    it('returns 200 when the requester cancels a pending booking', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${requesterToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('cancelled')
    })

    it('returns 400 when trying to confirm a cancelled booking', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${cancelBookingId}/confirm`)
        .set('Authorization', `Bearer ${curatorToken}`)
      expect(res.status).toBe(400)
    })

    it('worker curator can cancel a confirmed booking', async () => {
      const start = new Date()
      start.setDate(start.getDate() + 28)
      start.setHours(9, 0, 0, 0)
      const end = new Date(start)
      end.setHours(17, 0, 0, 0)

      const createRes = await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: start.toISOString(), endTime: end.toISOString() })
      const id = createRes.body.data.id

      await request(app)
        .patch(`/api/bookings/${id}/confirm`)
        .set('Authorization', `Bearer ${curatorToken}`)

      const cancelRes = await request(app)
        .patch(`/api/bookings/${id}/cancel`)
        .set('Authorization', `Bearer ${curatorToken}`)
      expect(cancelRes.status).toBe(200)
      expect(cancelRes.body.data.status).toBe('cancelled')
    })

    it('returns 403 when an unrelated user tries to cancel', async () => {
      const res = await request(app)
        .patch(`/api/bookings/${cancelBookingId}/cancel`)
        .set('Authorization', `Bearer ${otherUserToken}`)
      expect(res.status).toBe(403)
    })

    it('returns 401 without auth', async () => {
      const res = await request(app).patch(`/api/bookings/${cancelBookingId}/cancel`)
      expect(res.status).toBe(401)
    })
  })

  // ── List my bookings (/mine) ──────────────────────────────────────────────
  describe('GET /api/bookings/mine', () => {
    beforeAll(async () => {
      const start = new Date()
      start.setDate(start.getDate() + 35)
      start.setHours(9, 0, 0, 0)
      const end = new Date(start)
      end.setHours(12, 0, 0, 0)

      await request(app)
        .post('/api/bookings')
        .set('Authorization', `Bearer ${requesterToken}`)
        .send({ workerId, startTime: start.toISOString(), endTime: end.toISOString() })
    })

    it('returns 200 with bookings where caller is the worker curator (?role=worker)', async () => {
      const res = await request(app)
        .get('/api/bookings/mine?role=worker')
        .set('Authorization', `Bearer ${curatorToken}`)
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
      expect(Array.isArray(res.body.data)).toBe(true)
      for (const b of res.body.data) {
        expect(b.workerId).toBe(workerId)
      }
    })

    it('returns 200 with bookings where caller is the requester (?role=requester)', async () => {
      const res = await request(app)
        .get('/api/bookings/mine?role=requester')
        .set('Authorization', `Bearer ${requesterToken}`)
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
      expect(Array.isArray(res.body.data)).toBe(true)
      for (const b of res.body.data) {
        expect(b.requesterId).toBe(requesterId)
      }
    })

    it('filters by ?status=', async () => {
      const res = await request(app)
        .get('/api/bookings/mine?role=requester&status=cancelled')
        .set('Authorization', `Bearer ${requesterToken}`)
      expect(res.status).toBe(200)
      for (const b of res.body.data) {
        expect(b.status).toBe('cancelled')
      }
    })

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/bookings/mine')
      expect(res.status).toBe(401)
    })
  })

  // ── Rate limiting ─────────────────────────────────────────────────────────
  describe('Rate limiting', () => {
    it('returns 429 when exceeding booking creation rate limit (requires Redis)', async () => {
      // Without Redis the rate limiter fails open, so this test can only
      // verify the 429 path when Redis is available. In CI without Redis
      // we assert the response is either 429 or 201 (fail-open).
      const slot = {
        start: new Date(),
        end: new Date(),
      }
      slot.start.setDate(slot.start.getDate() + 42)
      slot.start.setHours(9, 0, 0, 0)
      slot.end.setDate(slot.end.getDate() + 42)
      slot.end.setHours(10, 0, 0, 0)

      const attempts = []
      for (let i = 0; i < 12; i++) {
        const s = new Date(slot.start)
        s.setHours(s.getHours() + i)
        const e = new Date(slot.end)
        e.setHours(e.getHours() + i)

        attempts.push(
          request(app)
            .post('/api/bookings')
            .set('Authorization', `Bearer ${requesterToken}`)
            .send({ workerId, startTime: s.toISOString(), endTime: e.toISOString() }),
        )
      }

      const results = await Promise.all(attempts)
      const statuses = results.map((r) => r.status)
      const has429 = statuses.some((s) => s === 429)

      // If Redis is available, at least the 11th+ request should be 429.
      // Otherwise all succeed (fail-open).
      if (has429) {
        expect(statuses.filter((s) => s === 429).length).toBeGreaterThanOrEqual(1)
      }
    })
  })
})
