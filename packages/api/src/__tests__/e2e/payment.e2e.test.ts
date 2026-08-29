/**
 * E2E tests for the payment lifecycle using Supertest against the real Express app.
 *
 * Covers two layers of "payment" in this codebase:
 *
 *  1. The stateless payment utilities exposed at /api/payments — tip fee
 *     deduction and platform fee configuration
 *     (services/payment.service.ts + controllers/payment.ts).
 *
 *  2. The persisted, stateful payment record that actually moves funds through a
 *     capture → release → refund cycle: an escrow, exposed at /api/escrow
 *     (services/escrow.service.ts via contracts.service.ts). This codebase has
 *     no separate "payments" table with its own release/refund routes — the
 *     escrow record IS the stateful payment resource — so the capture/release/
 *     refund cycle required for this suite is exercised through it:
 *       capture = create + activate (funds locked)
 *       release = pay out to the payee
 *       refund  = cancel back to the payer
 *
 * Complements escrow.e2e.test.ts (which drills into the dispute flow in
 * isolation) by chaining the payment side of a transaction end-to-end and
 * explicitly asserting the failure paths a payment API must reject: releasing
 * or refunding a payment twice must error, never silently succeed.
 *
 * Requires a live test database (TEST_DATABASE_URL env var).
 * Run: pnpm --filter @bluecollar/api exec vitest run src/__tests__/e2e/payment.e2e.test.ts
 */

import { describe, it, expect, beforeAll, vi } from 'vitest'
import request from 'supertest'
import { db } from '../../db.js'
import app from '../../app.js'

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

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

function futureIso(msFromNow = 60 * 60 * 1000): string {
  return new Date(Date.now() + msFromNow).toISOString()
}

/** Create an escrow and immediately activate it, i.e. "capture" the payment. */
async function captureEscrow(payerToken: string, payeeId: string, amountXlm = 200) {
  const created = await request(app)
    .post('/api/escrow')
    .set('Authorization', `Bearer ${payerToken}`)
    .send({ payeeId, amountXlm, expiresAt: futureIso() })
  const escrowId = created.body.data.id as string

  await request(app)
    .patch(`/api/escrow/${escrowId}/activate`)
    .set('Authorization', `Bearer ${payerToken}`)
    .send({ txId: `tx-payment-${escrowId}` })

  return escrowId
}

// ── State ─────────────────────────────────────────────────────────────────────

let payerToken: string
let payerId: string
let payeeToken: string
let payeeId: string
let adminToken: string

describe('Payment E2E', () => {
  beforeAll(async () => {
    const payer = await createVerifiedUser('payment-payer@e2e.com')
    const payee = await createVerifiedUser('payment-payee@e2e.com')
    const admin = await createVerifiedUser('payment-admin@e2e.com', 'admin')

    payerId = payer.id
    payeeId = payee.id

    payerToken = await loginAs('payment-payer@e2e.com')
    payeeToken = await loginAs('payment-payee@e2e.com')
    adminToken = await loginAs('payment-admin@e2e.com')
  })

  // ── Platform fee configuration ───────────────────────────────────────────
  describe('GET/PATCH /api/payments/fee', () => {
    it('returns the current platform fee without auth', async () => {
      const res = await request(app).get('/api/payments/fee')
      expect(res.status).toBe(200)
      expect(typeof res.body.data.fee_bps).toBe('number')
    })

    it('rejects a fee update from a non-admin → 403', async () => {
      const res = await request(app)
        .patch('/api/payments/fee')
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ fee_bps: 500 })
      expect(res.status).toBe(403)
    })

    it('returns 401 when updating the fee without auth', async () => {
      const res = await request(app).patch('/api/payments/fee').send({ fee_bps: 500 })
      expect(res.status).toBe(401)
    })

    it('allows an admin to update the fee, and the new rate is reflected in tip calculations', async () => {
      const updateRes = await request(app)
        .patch('/api/payments/fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fee_bps: 1000 }) // 10%
      expect(updateRes.status).toBe(200)
      expect(updateRes.body.data.fee_bps).toBe(1000)

      const tipRes = await request(app)
        .post('/api/payments/tip')
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ from: payerId, to: payeeId, amount: 1000 })
      expect(tipRes.status).toBe(200)
      expect(tipRes.body.data.fee).toBe(100) // 10% of 1000
      expect(tipRes.body.data.netAmount).toBe(900)

      // Restore the default fee so it doesn't affect the tests below.
      const restoreRes = await request(app)
        .patch('/api/payments/fee')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ fee_bps: 250 })
      expect(restoreRes.body.data.fee_bps).toBe(250)
    })
  })

  // ── Tip capture ───────────────────────────────────────────────────────────
  describe('POST /api/payments/tip', () => {
    it('captures a tip and deducts the platform fee → 200 with fee breakdown', async () => {
      const res = await request(app)
        .post('/api/payments/tip')
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ from: payerId, to: payeeId, amount: 400 })

      expect(res.status).toBe(200)
      expect(res.body.data.grossAmount).toBe(400)
      expect(res.body.data.fee).toBe(10) // default 250 bps = 2.5% of 400
      expect(res.body.data.netAmount).toBe(390)
    })

    it('returns 400 for a non-positive amount', async () => {
      const res = await request(app)
        .post('/api/payments/tip')
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ from: payerId, to: payeeId, amount: 0 })
      expect(res.status).toBe(400)
    })

    it('returns 400 when sender and recipient are the same', async () => {
      const res = await request(app)
        .post('/api/payments/tip')
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ from: payerId, to: payerId, amount: 100 })
      expect(res.status).toBe(400)
    })

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/payments/tip').send({ from: payerId, to: payeeId, amount: 100 })
      expect(res.status).toBe(401)
    })
  })

  // ── Capture → release cycle ──────────────────────────────────────────────
  describe('Payment capture → release cycle', () => {
    it('captures funds into escrow (create + activate) → status=active', async () => {
      const created = await request(app)
        .post('/api/escrow')
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ payeeId, amountXlm: 250, expiresAt: futureIso() })
      expect(created.status).toBe(201)
      expect(created.body.data.status).toBe('pending')
      const escrowId = created.body.data.id

      const activated = await request(app)
        .patch(`/api/escrow/${escrowId}/activate`)
        .set('Authorization', `Bearer ${payerToken}`)
        .send({ txId: `tx-capture-${escrowId}` })
      expect(activated.status).toBe(200)
      expect(activated.body.data.status).toBe('active')
    })

    it('releases a captured payment to the payee → status=released', async () => {
      const escrowId = await captureEscrow(payerToken, payeeId)

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('released')
      expect(res.body.data.releasedAt).toBeTruthy()
    })

    it('releasing an already-released payment errors instead of silently succeeding', async () => {
      const escrowId = await captureEscrow(payerToken, payeeId)
      const first = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(first.status).toBe(200)

      const second = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(second.status).toBe(400)

      // The underlying record must reflect exactly one release; the second
      // call must not have silently re-applied it or cleared releasedAt.
      const record = await db.escrowRecord.findUnique({ where: { id: escrowId } })
      expect(record!.status).toBe('released')
    })

    it('a non-payer cannot release a captured payment → 403', async () => {
      const escrowId = await captureEscrow(payerToken, payeeId)
      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payeeToken}`)
      expect(res.status).toBe(403)
    })
  })

  // ── Capture → refund cycle ───────────────────────────────────────────────
  describe('Payment capture → refund cycle', () => {
    it('rejects a refund attempted before the lock period elapses → 400', async () => {
      const escrowId = await captureEscrow(payerToken, payeeId)
      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(400)
    })

    it('refunds a captured payment back to the payer once the lock period elapses → status=cancelled', async () => {
      const escrowId = await captureEscrow(payerToken, payeeId)
      await db.escrowRecord.update({ where: { id: escrowId }, data: { expiresAt: new Date(Date.now() - 60_000) } })

      const res = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('cancelled')
      expect(res.body.data.cancelledAt).toBeTruthy()
    })

    it('refunding an already-released payment errors instead of silently succeeding', async () => {
      const escrowId = await captureEscrow(payerToken, payeeId)
      const release = await request(app)
        .patch(`/api/escrow/${escrowId}/release`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(release.status).toBe(200)

      const refund = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(refund.status).toBe(400)

      const record = await db.escrowRecord.findUnique({ where: { id: escrowId } })
      expect(record!.status).toBe('released')
    })

    it('refunding an already-refunded payment errors instead of silently succeeding', async () => {
      const escrowId = await captureEscrow(payerToken, payeeId)
      await db.escrowRecord.update({ where: { id: escrowId }, data: { expiresAt: new Date(Date.now() - 60_000) } })

      const first = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(first.status).toBe(200)

      const second = await request(app)
        .patch(`/api/escrow/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${payerToken}`)
      expect(second.status).toBe(400)

      const record = await db.escrowRecord.findUnique({ where: { id: escrowId } })
      expect(record!.status).toBe('cancelled')
    })
  })
})
