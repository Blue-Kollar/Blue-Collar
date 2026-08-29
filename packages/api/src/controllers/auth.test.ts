/**
 * Unit tests for the authentication and account management flow.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'

// ─── Env setup ───────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-secret'
process.env.APP_URL = 'http://localhost:3000'

// ─── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('../db.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../mailer/index.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}))

// Import AFTER mocks are registered
import { db } from '../db.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../mailer/index.js'
import {
  loginUser,
  registerUser,
  verifyAccount,
  requestPasswordReset,
  resetPassword,
} from '../services/auth.service.js'
import { AppError } from '../services/AppError.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Hash a raw token the same way the service does. */
function sha256(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Sign a verification JWT. */
function signVerificationToken(userId: string, expiresIn = '24h') {
  return jwt.sign({ id: userId, purpose: 'email-verify' }, process.env.JWT_SECRET!, { expiresIn })
}

// ─── Test definitions ─────────────────────────────────────────────────────────

describe('registerUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a user, stores hashed token, and sends a verification email', async () => {
    const mockUser = {
      id: 'user-1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'user',
      verified: false,
    }

    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    ;(db.user.create as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)
    ;(db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue(mockUser)

    await registerUser({ email: 'alice@example.com', password: 'secret', firstName: 'Alice', lastName: 'Smith' })

    const updateCall = (db.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.verificationToken).toBeTruthy()
    expect(sendVerificationEmail).toHaveBeenCalledOnce()
  })

  it('throws AppError 409 when email is already registered', async () => {
    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'existing' })

    await expect(registerUser('alice@example.com', 'secret', 'Alice', 'Smith')).rejects.toMatchObject({
      statusCode: 409,
    })
  })
})

describe('loginUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws AppError 403 when user is not verified', async () => {
    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      password: await import('argon2').then((m) => m.hash('secret')),
      verified: false,
      role: 'user',
    })

    await expect(loginUser({ email: 'alice@example.com', password: 'secret' })).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns data and token for verified user with correct credentials', async () => {
    const argon2 = await import('argon2')
    const hashedPw = await argon2.hash('secret')

    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      role: 'user',
      verified: true,
      password: hashedPw,
    })

    const result = await loginUser({ email: 'alice@example.com', password: 'secret' })
    expect(result.token).toBeTruthy()
    expect(result.data.email).toBe('alice@example.com')
  })
})

describe('verifyAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies the account for a valid token', async () => {
    const validToken = signVerificationToken('user-1')
    const hash = sha256(validToken)

    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      verified: false,
      verificationToken: hash,
      verificationTokenExpiry: new Date(Date.now() + 60_000),
    })
    ;(db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-1', verified: true })

    const result = await verifyAccount(validToken)
    expect(result).toBe(true)

    const updateCall = (db.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.verified).toBe(true)
  })

  it('returns false when account is already verified', async () => {
    const validToken = signVerificationToken('user-1')
    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 'user-1',
      verified: true,
    })
    const result = await verifyAccount(validToken)
    expect(result).toBe(false)
  })

  it('throws AppError 400 for an invalid token', async () => {
    await expect(verifyAccount('bad-token')).rejects.toMatchObject({ statusCode: 400 })
  })
})

describe('requestPasswordReset', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends email when user exists, silently no-ops when not', async () => {
    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      id: 'user-1',
      email: 'alice@example.com',
      firstName: 'Alice',
    })
    ;(db.user.update as ReturnType<typeof vi.fn>).mockResolvedValueOnce({})

    await requestPasswordReset('alice@example.com')
    expect(sendPasswordResetEmail).toHaveBeenCalledOnce()

    ;(db.user.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null)
    await requestPasswordReset('nobody@example.com')
    expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1) // still only once
  })
})

describe('resetPassword', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('throws AppError 400 for an invalid or expired token', async () => {
    ;(db.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
    await expect(resetPassword('invalid', 'new-password')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('updates the password and clears reset fields for a valid token', async () => {
    ;(db.user.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-123' })
    ;(db.user.update as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'user-123' })

    await resetPassword('secret-reset-token', 'new-secure-password')

    const updateCall = (db.user.update as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(updateCall.data.password).toBeTruthy()
    expect(updateCall.data.resetToken).toBeNull()
  })
})
