/**
 * E2E tests for the escrow payment lifecycle using Supertest against the real Express app.
 * Covers create -> activate -> release, cancel (time-locked), and dispute -> resolve.
 * Requires a live test database (TEST_DATABASE_URL env var).
 * Database is seeded/cleaned by testSetup.ts.
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

function futureDate(msFromNow = 60 * 60 * 1000): string {
  return new Date(Date.now() + msFromNow).toISOString()
}

async function createEscrowAs(token: string, payeeId: string, amountXlm = 100) {
  return request(app)
    .post('/api/escrow')
    .set('Authorization', `Bearer ${token}`)
    .send({ payeeId, amountXlm, expiresAt: futureDate() })
}

// ── State ─────────────────────────────────────────────────────────────────────

let payerToken: string
let payerId: string
let payeeToken: string
let payeeId: string
let thirdPartyToken: string
let adminToken: string
let adminId: string

describe('Escrow E2E', () => {
  beforeAll(async () => {
    const payer = await createVerifiedUser('escrow-payer@e2e.com')
    const payee = await createVerifiedUser('escrow-payee@e2e.com')
    const thirdParty = await createVerifiedUser('escrow-third@e2e.com')
    const admin = await createVerifiedUser('escrow-admin@e2e.com', 'admin')

    payerId = payer.id
    payeeId = payee.id
    adminId = admin.id

    payerToken = await loginAs('escrow-payer@e2e.com')
    payeeToken = await loginAs('escrow-payee@e2e.com')
    thirdPartyToken = await loginAs('escrow-third@e2e.com')
    adminToken = await loginAs('escrow-admin@e2e.com')
  })

  // ── Create ──────────────────────────────────────────────────────────────────
  describe('POST /api/escrow', () => {
    it('creates an escrow between payer and payee and returns 201 with pending status', async () => {
      const res = await createEscrowAs(payerToken, payeeId)
      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('pending')
      expect(res.body.data.payerId).toBe(payerId)
      expect(res.body.data.payeeId).toBe(payeeId)
    })

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/escrow').send({ payeeId, amountXlm: 100, expiresAt: futureDate() })
      expect(res.status).toBe(401)
    })
  })

  // ── Activate ────────────────────────────────────────────────────────────────
  describe('PATCH /api/escrow/:id/activate', () => {
    it('rejects activation by someone other than the payer', async () => {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .send({ txId: 'tx-unauthorized' })
      expect(res.status).toBe(403)
    })

    it('activates a pending escrow as the payer', async () => {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ txId: 'tx-activate-1' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('active')
      expect(res.body.data.txId).toBe('tx-activate-1')
    })

    it('returns 400 when activating an already-active escrow', async () => {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id
      await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ txId: 'tx-activate-2' })

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ txId: 'tx-activate-2-again' })
      expect(res.status).toBe(400)
    })
  })

  // ── Release ─────────────────────────────────────────────────────────────────
  describe('PATCH /api/escrow/:id/release', () => {
    async function createActiveEscrow() {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id
      await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ txId: `tx-${escrowId}` })
      return escrowId
    }

    it('returns 403 when a non-payer, non-admin party attempts release', async () => {
      const escrowId = await createActiveEscrow()
      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payeeToken}`)
      expect(res.status).toBe(403)
    })

    it('releases an active escrow as the payer', async () => {
      const escrowId = await createActiveEscrow()
      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('released')
      expect(res.body.data.releasedAt).toBeTruthy()
    })

    it('cannot re-release an already-released escrow', async () => {
      const escrowId = await createActiveEscrow()
      await request(app).patch(`/api/escrow/${escrowId}/release`).set('Authorization', `Bearer ${payerToken}`)

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(400)
    })

    it('cannot cancel an already-released escrow', async () => {
      const escrowId = await createActiveEscrow()
      await request(app).patch(`/api/escrow/${escrowId}/release`).set('Authorization', `Bearer ${payerToken}`)

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(400)
    })
  })

  // ── Cancel (time-locked) ────────────────────────────────────────────────────
  describe('PATCH /api/escrow/:id/cancel', () => {
    it('rejects cancellation by the payer while still within the lock period', async () => {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(400)
    })

    it('allows cancellation by the payer once the lock period has elapsed', async () => {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id
      // Simulate elapsed time by backdating expiresAt directly (server-side lock check).
      await db.escrowRecord.update({ where: { id: escrowId }, data: { expiresAt: new Date(Date.now() - 60_000) } })

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('cancelled')
      expect(res.body.data.cancelledAt).toBeTruthy()
    })

    it('allows an admin to cancel within the lock period', async () => {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('cancelled')
    })

    it('returns 403 when a non-payer, non-admin party attempts cancellation', async () => {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id
      await db.escrowRecord.update({ where: { id: escrowId }, data: { expiresAt: new Date(Date.now() - 60_000) } })

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
      expect(res.status).toBe(403)
    })
  })

  // ── Dispute: file ───────────────────────────────────────────────────────────
  describe('POST /api/escrow/:id/disputes', () => {
    async function createActiveEscrow() {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id
      await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ txId: `tx-${escrowId}` })
      return escrowId
    }

    it('returns 403 when a non-party files a dispute', async () => {
      const escrowId = await createActiveEscrow()
      const res = await request(app)
        .post(`/api/escrow/${escrowId}/disputes`)
        .set('Authorization', `Bearer ${thirdPartyToken}`)
        .send({ reason: 'Work not completed' })
      expect(res.status).toBe(403)
    })

    it('files a dispute as the payee and transitions the escrow to disputed', async () => {
      const escrowId = await createActiveEscrow()
      const res = await request(app)
        .post(`/api/escrow/${escrowId}/disputes`)
        .set('Authorization', `Bearer ${payeeToken}`)
        .send({ reason: 'Work not completed' })
      expect(res.status).toBe(201)
      expect(res.body.data.status).toBe('open')

      const escrow = await db.escrowRecord.findUnique({ where: { id: escrowId } })
      expect(escrow!.status).toBe('disputed')
    })

    it('blocks release once an escrow is disputed', async () => {
      const escrowId = await createActiveEscrow()
      await request(app)
        .post(`/api/escrow/${escrowId}/disputes`)
        .set('Authorization', `Bearer ${payeeToken}`)
        .send({ reason: 'Work not completed' })

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(400)
    })

    it('blocks cancellation once an escrow is disputed', async () => {
      const escrowId = await createActiveEscrow()
      await request(app)
        .post(`/api/escrow/${escrowId}/disputes`)
        .set('Authorization', `Bearer ${payeeToken}`)
        .send({ reason: 'Work not completed' })
      await db.escrowRecord.update({ where: { id: escrowId }, data: { expiresAt: new Date(Date.now() - 60_000) } })

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(400)
    })
  })

  // ── Dispute: resolve (admin only) ───────────────────────────────────────────
  describe('PATCH /api/escrow/:id/disputes/:disputeId', () => {
    async function createDisputedEscrow() {
      const created = await createEscrowAs(payerToken, payeeId)
      const escrowId = created.body.data.id
      await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ txId: `tx-${escrowId}` })
      const dispute = await request(app)
        .post(`/api/escrow/${escrowId}/disputes`)
        .set('Authorization', `Bearer ${payeeToken}`)
        .send({ reason: 'Work not completed' })
      return { escrowId, disputeId: dispute.body.data.id as string }
    }

    it('returns 403 when a non-admin attempts to resolve a dispute', async () => {
      const { escrowId, disputeId } = await createDisputedEscrow()
      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ status: 'resolved', resolution: 'Refund issued' })
      expect(res.status).toBe(403)
    })

    it('resolves a dispute as admin (resolved -> escrow released, a terminal state)', async () => {
      const { escrowId, disputeId } = await createDisputedEscrow()
      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved', resolution: 'Funds released to worker' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('resolved')

      const escrow = await db.escrowRecord.findUnique({ where: { id: escrowId } })
      expect(escrow!.status).toBe('released')
      expect(escrow!.releasedAt).toBeTruthy()
    })

    it('resolves a dispute as admin (dismissed -> escrow cancelled, a terminal state)', async () => {
      const { escrowId, disputeId } = await createDisputedEscrow()
      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'dismissed', resolution: 'No evidence of incomplete work' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('dismissed')

      const escrow = await db.escrowRecord.findUnique({ where: { id: escrowId } })
      expect(escrow!.status).toBe('cancelled')
      expect(escrow!.cancelledAt).toBeTruthy()
    })
  })
})
