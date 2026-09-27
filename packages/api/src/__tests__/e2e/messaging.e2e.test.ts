/**
 * E2E tests for the messaging API (routes/conversations.ts, the implementation
 * actually mounted in app.ts — routes/messages.ts is unmounted/dead code) using
 * Supertest against the real Express app.
 * Requires a live test database (TEST_DATABASE_URL env var).
 * Database is seeded/cleaned by testSetup.ts.
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

let aliceId: string
let aliceToken: string
let bobId: string
let bobToken: string
let carolToken: string

describe('Messaging E2E', () => {
  // The global setup (src/__tests__/setup.ts) truncates User/Message/etc.
  // before EACH test, so shared fixtures must be (re)created per-test via
  // beforeEach rather than beforeAll.
  beforeEach(async () => {
    const alice = await createVerifiedUser('alice@messaging-e2e.com')
    const bob = await createVerifiedUser('bob@messaging-e2e.com')
    await createVerifiedUser('carol@messaging-e2e.com')

    aliceId = alice.id
    bobId = bob.id

    aliceToken = await loginAs('alice@messaging-e2e.com')
    bobToken = await loginAs('bob@messaging-e2e.com')
    carolToken = await loginAs('carol@messaging-e2e.com')
  })

  // ── Create conversation + send/list messages ──────────────────────────────
  describe('POST /api/conversations + GET /api/conversations/:id/messages', () => {
    it('creates a conversation between two users and returns 201', async () => {
      const res = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ participantId: bobId, initialMessage: 'Hey Bob!' })

      expect(res.status).toBe(201)
      expect(res.body.status).toBe('success')
      expect(res.body.data.participants).toHaveLength(2)
    })

    it('a sent message appears in GET /:conversationId/messages', async () => {
      const create = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ participantId: bobId, initialMessage: 'Starting a fresh thread' })
      const conversationId = create.body.data.id as string

      const send = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ body: 'Can you take a look at the plumbing job?' })
      expect(send.status).toBe(201)

      const list = await request(app)
        .get(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${bobToken}`)
      expect(list.status).toBe(200)
      const bodies = list.body.data.map((m: any) => m.body)
      expect(bodies).toContain('Can you take a look at the plumbing job?')
    })
  })

  // ── Unread counts ──────────────────────────────────────────────────────────
  describe('GET /api/conversations/unread + PATCH /:id/read', () => {
    it('reflects the correct count after messages are sent/read, scoped to one conversation', async () => {
      // Conversation 1: Alice -> Bob
      const conv1 = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ participantId: bobId, initialMessage: 'conv1 msg1' })
      const conv1Id = conv1.body.data.id as string

      // Conversation 2: Carol -> Bob (independent conversation, must be unaffected)
      const conv2 = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${carolToken}`)
        .send({ participantId: bobId, initialMessage: 'conv2 msg1' })
      const conv2Id = conv2.body.data.id as string

      const afterFirstMessages = await request(app)
        .get('/api/conversations/unread')
        .set('Authorization', `Bearer ${bobToken}`)
      expect(afterFirstMessages.body.data.unreadCount).toBe(2) // conv1 msg1 + conv2 msg1

      await request(app)
        .post(`/api/conversations/${conv1Id}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ body: 'conv1 msg2' })

      const afterSecondMessage = await request(app)
        .get('/api/conversations/unread')
        .set('Authorization', `Bearer ${bobToken}`)
      expect(afterSecondMessage.body.data.unreadCount).toBe(3) // conv1 msg1+msg2 + conv2 msg1

      const markRead = await request(app)
        .patch(`/api/conversations/${conv1Id}/read`)
        .set('Authorization', `Bearer ${bobToken}`)
      expect(markRead.status).toBe(200)

      const afterMarkRead = await request(app)
        .get('/api/conversations/unread')
        .set('Authorization', `Bearer ${bobToken}`)
      // conv1 cleared, conv2's single unread message remains — proves the read
      // is scoped to conv1 only, not a global reset.
      expect(afterMarkRead.body.data.unreadCount).toBe(1)

      const conv2Detail = await request(app)
        .get(`/api/conversations/${conv2Id}`)
        .set('Authorization', `Bearer ${bobToken}`)
      expect(conv2Detail.status).toBe(200)
    })
  })

  // ── Search ─────────────────────────────────────────────────────────────────
  describe('GET /api/conversations/:id/messages/search', () => {
    it('finds a message by keyword', async () => {
      const conv = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ participantId: bobId, initialMessage: 'irrelevant opener' })
      const conversationId = conv.body.data.id as string

      await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ body: 'The leaky faucet needs a new washer' })

      const search = await request(app)
        .get(`/api/conversations/${conversationId}/messages/search`)
        .query({ q: 'faucet' })
        .set('Authorization', `Bearer ${bobToken}`)

      expect(search.status).toBe(200)
      expect(search.body.data.length).toBeGreaterThan(0)
      expect(search.body.data.some((m: any) => m.body.includes('faucet'))).toBe(true)
    })
  })

  // ── Delete (author only) ─────────────────────────────────────────────────
  describe('DELETE /api/conversations/:messageId', () => {
    it('redacts the message when deleted by its author', async () => {
      const conv = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ participantId: bobId, initialMessage: 'opener' })
      const conversationId = conv.body.data.id as string

      const sent = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ body: 'oops, wrong thread' })
      const messageId = sent.body.data.id as string

      const del = await request(app)
        .delete(`/api/conversations/${messageId}`)
        .set('Authorization', `Bearer ${aliceToken}`)
      expect(del.status).toBe(200)
      expect(del.body.data.body).toBe('[deleted]')

      const stored = await db.message.findUnique({ where: { id: messageId } })
      expect(stored).not.toBeNull()
      expect(stored!.body).toBe('[deleted]')
    })

    it('returns 403 when a non-author tries to delete', async () => {
      const conv = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ participantId: bobId, initialMessage: 'opener' })
      const conversationId = conv.body.data.id as string

      const sent = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ body: 'alice-authored message' })
      const messageId = sent.body.data.id as string

      const del = await request(app)
        .delete(`/api/conversations/${messageId}`)
        .set('Authorization', `Bearer ${bobToken}`)
      expect(del.status).toBe(403)

      const stored = await db.message.findUnique({ where: { id: messageId } })
      expect(stored!.body).toBe('alice-authored message')
    })
  })

  // ── Messaging -> notification integration ────────────────────────────────
  describe('sending a message triggers a notification', () => {
    it('creates an in-app notification record for the recipient', async () => {
      const conv = await request(app)
        .post('/api/conversations')
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ participantId: bobId, initialMessage: 'opener' })
      const conversationId = conv.body.data.id as string

      const before = await db.notification.count({ where: { userId: bobId, type: 'message' } })

      const send = await request(app)
        .post(`/api/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${aliceToken}`)
        .send({ body: 'You have a new job request' })
      expect(send.status).toBe(201)

      const after = await db.notification.count({ where: { userId: bobId, type: 'message' } })
      expect(after).toBe(before + 1)

      const notification = await db.notification.findFirst({
        where: { userId: bobId, type: 'message' },
        orderBy: { createdAt: 'desc' },
      })
      expect(notification).not.toBeNull()
      expect(notification!.message).toContain('You have a new job request')

      // The sender should not get a self-notification.
      const senderNotifications = await db.notification.count({ where: { userId: aliceId, type: 'message' } })
      expect(senderNotifications).toBe(0)
    })
  })
})
