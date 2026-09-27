/**
 * E2E tests for the notifications API (routes/notifications.ts, mounted in
 * app.ts at /api/notifications) using Supertest against the real Express app.
 * Requires a live test database (TEST_DATABASE_URL env var).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { db } from '../../db.js'
import app from '../../app.js'

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

import { vi } from 'vitest'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createVerifiedUser(email: string) {
  const argon2 = await import('argon2')
  return db.user.create({
    data: {
      email,
      password: await argon2.hash('Password123!'),
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      verified: true,
    },
  })
}

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' })
  return res.body.token as string
}

// ── State ─────────────────────────────────────────────────────────────────────

let userId: string
let userToken: string

describe('Notifications E2E', () => {
  // Global setup truncates User/Notification/etc. before EACH test, so
  // fixtures must be (re)created per-test rather than once in beforeAll.
  beforeEach(async () => {
    const user = await createVerifiedUser('dana@notifications-e2e.com')
    userId = user.id
    userToken = await loginAs('dana@notifications-e2e.com')
  })

  // ── Preferences: persisted + respected ────────────────────────────────────
  describe('PUT /api/notifications/preferences', () => {
    it('persists changes and GET reflects them', async () => {
      const put = await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ announcements: false })
      expect(put.status).toBe(200)

      const get = await request(app)
        .get('/api/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
      expect(get.status).toBe(200)
      expect(get.body.data.announcements).toBe(false)
      expect(get.body.data.newWorkerNearby).toBe(true)
      expect(get.body.data.statusChange).toBe(true)
      expect(get.body.data.reviewReply).toBe(true)
    })

    it('disabling a channel preference means dispatch does not send via that channel, while other channels still deliver', async () => {
      // Real dispatch call sites (job.service.ts, escrow.service.ts) always use
      // type: 'system', which is gated on the `announcements` preference for
      // email but always attempts push — so this is the realistic case.
      await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ announcements: false })

      const dispatch1 = await request(app)
        .post('/api/notifications/dispatch')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'system', title: 'Platform update', message: 'New feature launched' })
      expect(dispatch1.status).toBe(201)

      const notif1 = await db.notification.findFirst({
        where: { userId, type: 'system', title: 'Platform update' },
        orderBy: { createdAt: 'desc' },
      })
      expect(notif1).not.toBeNull()

      const log1 = await request(app)
        .get(`/api/notifications/${notif1!.id}/delivery-log`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(log1.status).toBe(200)
      expect(log1.body.data.some((entry: any) => entry.channel === 'email')).toBe(false)
      expect(log1.body.data.some((entry: any) => entry.channel === 'push')).toBe(true)

      // Flip the preference back on and dispatch again — email should now appear.
      await request(app)
        .put('/api/notifications/preferences')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ announcements: true })

      const dispatch2 = await request(app)
        .post('/api/notifications/dispatch')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ type: 'system', title: 'Another update', message: 'Second announcement' })
      expect(dispatch2.status).toBe(201)

      const notif2 = await db.notification.findFirst({
        where: { userId, type: 'system', title: 'Another update' },
        orderBy: { createdAt: 'desc' },
      })
      expect(notif2).not.toBeNull()

      const log2 = await request(app)
        .get(`/api/notifications/${notif2!.id}/delivery-log`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(log2.status).toBe(200)
      const emailEntry = log2.body.data.find((entry: any) => entry.channel === 'email')
      expect(emailEntry).toBeDefined()
      expect(emailEntry.status).toBe('sent')
    })
  })

  // ── Read / unread ────────────────────────────────────────────────────────
  describe('PATCH /:id/read + PATCH /read-all', () => {
    it('correctly updates unread-count at each step', async () => {
      await db.notification.createMany({
        data: [
          { userId, type: 'system', title: 'One', message: 'first' },
          { userId, type: 'system', title: 'Two', message: 'second' },
          { userId, type: 'system', title: 'Three', message: 'third' },
        ],
      })

      const initial = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
      expect(initial.body.data.count).toBe(3)

      const notifications = await db.notification.findMany({ where: { userId }, orderBy: { title: 'asc' } })
      const firstId = notifications[0].id

      const markOne = await request(app)
        .patch(`/api/notifications/${firstId}/read`)
        .set('Authorization', `Bearer ${userToken}`)
      expect(markOne.status).toBe(200)

      const afterOne = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
      expect(afterOne.body.data.count).toBe(2)

      const markAll = await request(app)
        .patch('/api/notifications/read-all')
        .set('Authorization', `Bearer ${userToken}`)
      expect(markAll.status).toBe(200)
      expect(markAll.body.data.count).toBe(2) // the two still-unread ones

      const afterAll = await request(app)
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${userToken}`)
      expect(afterAll.body.data.count).toBe(0)
    })
  })
})
