/**
 * E2E tests for the auth flow using Supertest against the real Express app.
 * Requires a live test database (TEST_DATABASE_URL env var).
 * Database is seeded/cleaned by testSetup.ts.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import request from 'supertest'
import { db } from '../../db.js'
import app from '../../app.js'

// Silence nodemailer in e2e — we don't need real emails
vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

import { vi } from 'vitest'

const USER = {
  email: 'e2e-auth@example.com',
  password: 'Password123!',
  firstName: 'E2E',
  lastName: 'User',
}

let verificationToken: string
let resetToken: string
let authToken: string

describe('Auth E2E', () => {
  // ── Register ────────────────────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('creates a new account and returns 201', async () => {
      const res = await request(app).post('/api/auth/register').send(USER)
      expect(res.status).toBe(201)
      expect(res.body.status).toBe('success')
      expect(res.body.data.email).toBe(USER.email)
    })

    it('returns 409 for duplicate email', async () => {
      const res = await request(app).post('/api/auth/register').send(USER)
      expect(res.status).toBe(409)
    })
  })

  // ── Verify account ──────────────────────────────────────────────────────────
  describe('PUT /api/auth/verify-account', () => {
    beforeAll(async () => {
      // Grab the raw verification token stored in the DB
      const user = await db.user.findUnique({ where: { email: USER.email } })
      // The service stores a SHA-256 hash; we need the raw JWT from the token
      // field. In tests we re-generate it by reading the stored hash and
      // bypassing — instead, mark the user verified directly so login works.
      // (Full token round-trip is tested via the service unit tests.)
      await db.user.update({ where: { email: USER.email }, data: { verified: true } })
    })

    it('returns 400 for an invalid token', async () => {
      const res = await request(app).put('/api/auth/verify-account').send({ token: 'bad-token' })
      expect(res.status).toBe(400)
    })
  })

  // ── Login ───────────────────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('returns 202 with a JWT for valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: USER.email, password: USER.password })
      expect(res.status).toBe(202)
      expect(res.body.token).toBeDefined()
      authToken = res.body.token
    })

    it('returns 401 for wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: USER.email, password: 'wrong' })
      expect(res.status).toBe(401)
    })

    it('returns 401 for unknown email', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: 'ghost@x.com', password: 'x' })
      expect(res.status).toBe(401)
    })
  })

  // ── Me ──────────────────────────────────────────────────────────────────────
  describe('GET /api/auth/me', () => {
    it('returns the authenticated user', async () => {
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${authToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data.email).toBe(USER.email)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/auth/me')
      expect(res.status).toBe(401)
    })
  })

  // ── Logout ──────────────────────────────────────────────────────────────────
  describe('DELETE /api/auth/logout', () => {
    it('returns 200 for an authenticated user', async () => {
      const res = await request(app).delete('/api/auth/logout').set('Authorization', `Bearer ${authToken}`)
      expect(res.status).toBe(200)
    })

    it('returns 401 without a token', async () => {
      const res = await request(app).delete('/api/auth/logout')
      expect(res.status).toBe(401)
    })
  })

  // ── Forgot password ─────────────────────────────────────────────────────────
  describe('POST /api/auth/forgot-password', () => {
    it('always returns 200 (prevents email enumeration)', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: USER.email })
      expect(res.status).toBe(200)
    })

    it('returns 200 even for unknown email', async () => {
      const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@x.com' })
      expect(res.status).toBe(200)
    })
  })

  // ── Reset password ──────────────────────────────────────────────────────────
  describe('PUT /api/auth/reset-password', () => {
    beforeAll(async () => {
      // Grab the raw reset token from the DB (stored as SHA-256 hash)
      // We trigger forgot-password to populate the fields, then read the hash
      // and use it directly — the service hashes the incoming token before
      // comparing, so we need the raw token. Inject it manually for the test.
      const crypto = await import('node:crypto')
      resetToken = crypto.randomBytes(32).toString('hex')
      const hash = crypto.createHash('sha256').update(resetToken).digest('hex')
      await db.user.update({
        where: { email: USER.email },
        data: { resetToken: hash, resetTokenExpiry: new Date(Date.now() + 3_600_000) },
      })
    })

    it('resets the password with a valid token', async () => {
      const res = await request(app)
        .put('/api/auth/reset-password')
        .send({ token: resetToken, password: 'NewPassword456!' })
      expect(res.status).toBe(200)
    })

    it('returns 400 for an expired/invalid token', async () => {
      const res = await request(app)
        .put('/api/auth/reset-password')
        .send({ token: 'invalid-token', password: 'NewPassword456!' })
      expect(res.status).toBe(400)
    })

    it('can login with the new password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: USER.email, password: 'NewPassword456!' })
      expect(res.status).toBe(202)
    })
  })
})
