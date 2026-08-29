/**
 * E2E tests for TOTP-based 2FA (setup → enable → login/verify → disable).
 * Requires a live test database (TEST_DATABASE_URL env var).
 * Database is seeded/cleaned by testSetup.ts.
 *
 * Covers services/twoFactor.service.ts + controllers/twoFactor.ts, which is
 * the implementation actually wired into routes/auth.ts (`/2fa/setup`,
 * `/2fa/enable`, `/2fa/verify`, `/2fa/verify-backup`, `DELETE /2fa`,
 * `/2fa/backup-codes/regenerate`). A second, unwired 2FA implementation also
 * exists (auth.service.ts: generateTOTPSecret/enableTwoFactorAuth/
 * verifyTOTPCode/disableTwoFactorAuth, controllers/auth.ts: enrollTwoFactor/
 * verifyTwoFactor/disableTwoFactor) but is never imported by any route file
 * — it is dead code and out of scope here.
 *
 * Known gaps documented (not fixed) by tests below, so a future regression
 * shows up as a changed assertion rather than silently reappearing:
 *
 *  1. POST /api/auth/login never checks `user.twoFactorEnabled`. Enabling
 *     2FA does NOT gate login — correct email/password always returns a
 *     full access token immediately. `/2fa/verify` exists and validates a
 *     TOTP code correctly in isolation, but nothing in the login flow ever
 *     requires it. See "POST /api/auth/login after 2FA is enabled" below.
 *  2. POST /api/auth/2fa/verify does not issue a JWT/session token on
 *     success (controllers/twoFactor.ts) — it only confirms the code was
 *     valid. There is no step-up exchange from "verified TOTP" to a session.
 *  3. twoFactor.service.ts has no replay protection: a valid TOTP code can
 *     be reused repeatedly within its validation window (±1 period). See
 *     "Replay behavior" below.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import * as OTPAuth from 'otpauth'
import { db } from '../../db.js'
import app from '../../app.js'

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

import { vi } from 'vitest'

const PASSWORD = 'Password123!'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createVerifiedUser(email: string) {
  const argon2 = await import('argon2')
  return db.user.create({
    data: {
      email,
      password: await argon2.hash(PASSWORD),
      firstName: 'TwoFactor',
      lastName: 'Tester',
      role: 'user',
      verified: true,
    },
  })
}

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD })
  return res.body.token as string
}

/** Mirrors the exact TOTP parameters used by twoFactor.service.ts. */
function totpFor(base32Secret: string, email: string) {
  return new OTPAuth.TOTP({
    issuer: 'BlueCollar',
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  })
}

/** A code guaranteed to fall outside the service's ±1 period validation window. */
function wrongCodeFor(base32Secret: string, email: string) {
  return totpFor(base32Secret, email).generate({ timestamp: Date.now() + 5 * 60_000 })
}

// ── State ────────────────────────────────────────────────────────────────────

let userId: string
let userEmail: string
let authToken: string
let secret: string

describe('Two-Factor Auth E2E', () => {
  beforeAll(async () => {
    userEmail = 'e2e-2fa@example.com'
    const user = await createVerifiedUser(userEmail)
    userId = user.id
    authToken = await loginAs(userEmail)
  })

  // ── Setup ────────────────────────────────────────────────────────────────
  describe('POST /api/auth/2fa/setup', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).post('/api/auth/2fa/setup')
      expect(res.status).toBe(401)
    })

    it('returns a secret + otpauth URI + QR code for an authenticated user', async () => {
      const res = await request(app)
        .post('/api/auth/2fa/setup')
        .set('Authorization', `Bearer ${authToken}`)

      expect(res.status).toBe(200)
      expect(typeof res.body.data.secret).toBe('string')
      expect(res.body.data.secret.length).toBeGreaterThan(0)
      expect(res.body.data.uri).toMatch(/^otpauth:\/\/totp\//)
      expect(res.body.data.qrCode).toMatch(/^data:image\/png;base64,/)

      secret = res.body.data.secret

      // Secret is persisted immediately, but 2FA is not enabled until verified.
      const stored = await db.user.findUnique({ where: { id: userId } })
      expect(stored?.twoFactorSecret).toBe(secret)
      expect(stored?.twoFactorEnabled).toBe(false)
    })
  })

  // ── Enable ───────────────────────────────────────────────────────────────
  describe('POST /api/auth/2fa/enable', () => {
    it('returns 400 when no token is provided', async () => {
      const res = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
      expect(res.status).toBe(400)

      const stored = await db.user.findUnique({ where: { id: userId } })
      expect(stored?.twoFactorEnabled).toBe(false)
    })

    it('rejects an incorrect TOTP token and leaves 2FA disabled', async () => {
      const wrong = wrongCodeFor(secret, userEmail)
      const res = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: wrong })
      expect(res.status).toBe(400)

      const stored = await db.user.findUnique({ where: { id: userId } })
      expect(stored?.twoFactorEnabled).toBe(false)
    })

    it('accepts the correct current TOTP token and enables 2FA', async () => {
      const code = totpFor(secret, userEmail).generate()
      const res = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: code })

      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data.backupCodes)).toBe(true)
      expect(res.body.data.backupCodes.length).toBeGreaterThan(0)

      const stored = await db.user.findUnique({ where: { id: userId } })
      expect(stored?.twoFactorEnabled).toBe(true)
    })

    it('returns 409 when 2FA is already enabled', async () => {
      const code = totpFor(secret, userEmail).generate()
      const res = await request(app)
        .post('/api/auth/2fa/enable')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: code })
      expect(res.status).toBe(409)
    })
  })

  // ── Login after 2FA is enabled ───────────────────────────────────────────
  // KNOWN GAP: loginUser() in auth.service.ts never checks twoFactorEnabled.
  // This test documents the actual (insecure) current contract: a normal
  // login with correct credentials succeeds fully — no step-up challenge is
  // issued — even though 2FA is enabled on the account.
  describe('POST /api/auth/login after 2FA is enabled', () => {
    it('KNOWN GAP: still returns a full access token without requiring a 2FA step', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: userEmail, password: PASSWORD })

      expect(res.status).toBe(202)
      expect(typeof res.body.token).toBe('string')
      expect(res.body.token.length).toBeGreaterThan(0)
      // No pending-2FA / step-up indicator of any kind is returned.
      expect(res.body.requiresTwoFactor).toBeUndefined()
    })
  })

  // ── Verify (standalone TOTP check, not wired into login) ────────────────
  describe('POST /api/auth/2fa/verify', () => {
    it('returns 400 when userId or token is missing', async () => {
      const res = await request(app).post('/api/auth/2fa/verify').send({ userId })
      expect(res.status).toBe(400)
    })

    it('returns 401 for a nonexistent userId', async () => {
      const code = totpFor(secret, userEmail).generate()
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ userId: 'nonexistent-user-id', token: code })
      expect(res.status).toBe(401)
    })

    it('returns 401 for a user who has not enabled 2FA', async () => {
      const other = await createVerifiedUser('e2e-2fa-no2fa@example.com')
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ userId: other.id, token: '123456' })
      expect(res.status).toBe(401)
    })

    it('rejects an incorrect/expired TOTP code', async () => {
      const wrong = wrongCodeFor(secret, userEmail)
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ userId, token: wrong })
      expect(res.status).toBe(401)
    })

    it('accepts the correct current TOTP code', async () => {
      const code = totpFor(secret, userEmail).generate()
      const res = await request(app)
        .post('/api/auth/2fa/verify')
        .send({ userId, token: code })

      expect(res.status).toBe(200)
      // KNOWN GAP: no JWT/session token is issued here — verify2FA only
      // confirms the code, it does not complete a login.
      expect(res.body.token).toBeUndefined()
    })
  })

  // ── Replay behavior ──────────────────────────────────────────────────────
  // KNOWN GAP: twoFactor.service.ts does not track used codes, so a valid
  // TOTP code can be replayed within its window. This test documents that
  // current (insecure) behavior rather than asserting protection that does
  // not exist.
  describe('Replay behavior (no protection implemented)', () => {
    it('KNOWN GAP: the same valid TOTP code is accepted twice in a row', async () => {
      const code = totpFor(secret, userEmail).generate()

      const first = await request(app).post('/api/auth/2fa/verify').send({ userId, token: code })
      const second = await request(app).post('/api/auth/2fa/verify').send({ userId, token: code })

      expect(first.status).toBe(200)
      expect(second.status).toBe(200)
    })
  })

  // ── Disable (requires re-authentication via TOTP) ───────────────────────
  describe('DELETE /api/auth/2fa', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await request(app).delete('/api/auth/2fa').send({ token: '123456' })
      expect(res.status).toBe(401)
    })

    it('returns 400 when no token is provided', async () => {
      const res = await request(app)
        .delete('/api/auth/2fa')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
      expect(res.status).toBe(400)

      const stored = await db.user.findUnique({ where: { id: userId } })
      expect(stored?.twoFactorEnabled).toBe(true)
    })

    it('rejects disabling with an incorrect TOTP token', async () => {
      const wrong = wrongCodeFor(secret, userEmail)
      const res = await request(app)
        .delete('/api/auth/2fa')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: wrong })
      expect(res.status).toBe(400)

      const stored = await db.user.findUnique({ where: { id: userId } })
      expect(stored?.twoFactorEnabled).toBe(true)
    })

    it('disables 2FA when given a correct, current TOTP token', async () => {
      const code = totpFor(secret, userEmail).generate()
      const res = await request(app)
        .delete('/api/auth/2fa')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ token: code })
      expect(res.status).toBe(200)

      const stored = await db.user.findUnique({ where: { id: userId } })
      expect(stored?.twoFactorEnabled).toBe(false)
      expect(stored?.twoFactorSecret).toBeNull()
      expect(stored?.twoFactorBackupCodes).toEqual([])
    })
  })
})
