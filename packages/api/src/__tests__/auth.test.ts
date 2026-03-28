/**
 * Unit tests for the auth controller (src/controllers/auth.ts).
 * All external dependencies (auth service, db, nodemailer) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Env setup (must run before any module that reads process.env) ─────────────
process.env.JWT_SECRET = 'test-secret'
process.env.APP_URL = 'http://localhost:3000'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../services/auth.service.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  verifyAccount: vi.fn(),
}))

vi.mock('../../db.js', () => ({
  db: {
    user: { findUnique: vi.fn() },
  },
}))

// Prevent nodemailer from opening real SMTP connections
vi.mock('../../mailer/transport.js', () => ({
  transporter: {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'mock-message-id' }),
  },
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import * as authService from '../../services/auth.service.js'
import { db } from '../../db.js'
import { register, login, logout, forgotPassword, resetPassword } from '../../controllers/auth.js'
import { AppError } from '../../services/AppError.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.redirect = vi.fn().mockReturnValue(res)
  return res
}

function makeReq(body: Record<string, any> = {}, user?: any): any {
  return { body, user }
}

const mockUser = {
  id: 'user-1',
  email: 'alice@example.com',
  firstName: 'Alice',
  lastName: 'Smith',
  role: 'user',
  verified: true,
  password: 'hashed-password',
  googleId: null,
  walletAddress: null,
  avatar: null,
  bio: null,
  phone: null,
  locationId: null,
  resetToken: null,
  resetTokenExpiry: null,
  verificationToken: null,
  verificationTokenExpiry: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ─── register ─────────────────────────────────────────────────────────────────

describe('register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with user data on success', async () => {
    ;(authService.registerUser as any).mockResolvedValue(mockUser)
    const req = makeReq({ email: 'alice@example.com', password: 'secret', firstName: 'Alice', lastName: 'Smith' })
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    const body = res.json.mock.calls[0][0]
    expect(body.status).toBe('success')
    expect(body.code).toBe(201)
    expect(body.message).toMatch(/registration successful/i)
    expect(body.data).toBeDefined()
  })

  it('returns 409 when the email is already registered', async () => {
    ;(authService.registerUser as any).mockRejectedValue(new AppError('Email already in use', 409))
    const req = makeReq({ email: 'alice@example.com', password: 'secret', firstName: 'Alice', lastName: 'Smith' })
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(409)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', message: 'Email already in use', code: 409 }),
    )
  })

  it('returns 422 when required fields are missing', async () => {
    ;(authService.registerUser as any).mockRejectedValue(new AppError('Validation failed', 422))
    const req = makeReq({})
    const res = makeRes()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(422)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', code: 422 }))
  })
})

// ─── login ────────────────────────────────────────────────────────────────────

describe('login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 202 with user data and a JWT token on success', async () => {
    ;(authService.loginUser as any).mockResolvedValue({ data: mockUser, token: 'signed-jwt' })
    const req = makeReq({ email: 'alice@example.com', password: 'secret' })
    const res = makeRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(202)
    const body = res.json.mock.calls[0][0]
    expect(body.status).toBe('success')
    expect(body.token).toBe('signed-jwt')
    expect(body.code).toBe(202)
  })

  it('returns 401 for a wrong password', async () => {
    ;(authService.loginUser as any).mockRejectedValue(new AppError('Invalid credentials', 401))
    const req = makeReq({ email: 'alice@example.com', password: 'wrong-password' })
    const res = makeRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', code: 401 }),
    )
  })

  it('returns 401 for a non-existent user', async () => {
    ;(authService.loginUser as any).mockRejectedValue(new AppError('Invalid credentials', 401))
    const req = makeReq({ email: 'ghost@example.com', password: 'secret' })
    const res = makeRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(401)
  })

  it('returns 403 for an unverified account', async () => {
    ;(authService.loginUser as any).mockRejectedValue(
      new AppError('Your email address has not been verified. Please check your inbox and click the verification link.', 403),
    )
    const req = makeReq({ email: 'alice@example.com', password: 'secret' })
    const res = makeRes()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', code: 403 }))
  })
})

// ─── logout ───────────────────────────────────────────────────────────────────

describe('logout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with a success message for an authenticated user', async () => {
    const req = makeReq({}, { id: 'user-1', role: 'user' })
    const res = makeRes()

    await logout(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', message: 'Logged out', code: 200 }),
    )
  })

  it('returns 200 even without an authenticated user (auth enforced by middleware, not controller)', async () => {
    const req = makeReq()
    const res = makeRes()

    await logout(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
  })
})

// ─── forgotPassword ───────────────────────────────────────────────────────────

describe('forgotPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('always returns 200 to avoid leaking user existence', async () => {
    ;(authService.requestPasswordReset as any).mockResolvedValue(undefined)
    const req = makeReq({ email: 'ghost@example.com' })
    const res = makeRes()

    await forgotPassword(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200 }))
  })

  it('calls requestPasswordReset with the provided email when user exists', async () => {
    ;(authService.requestPasswordReset as any).mockResolvedValue(undefined)
    const req = makeReq({ email: 'alice@example.com' })
    const res = makeRes()

    await forgotPassword(req, res)

    expect(authService.requestPasswordReset).toHaveBeenCalledOnce()
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('alice@example.com')
    expect(res.status).toHaveBeenCalledWith(200)
  })
})

// ─── resetPassword ────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on a successful password reset', async () => {
    ;(authService.resetPassword as any).mockResolvedValue(undefined)
    const req = makeReq({ token: 'valid-reset-token', password: 'new-secure-password' })
    const res = makeRes()

    await resetPassword(req, res)

    expect(res.status).toHaveBeenCalledWith(200)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', message: 'Password reset successful', code: 200 }),
    )
  })

  it('returns 400 for an expired reset token', async () => {
    ;(authService.resetPassword as any).mockRejectedValue(
      new AppError('Token is invalid or has expired', 400),
    )
    const req = makeReq({ token: 'expired-token', password: 'new-secure-password' })
    const res = makeRes()

    await resetPassword(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', code: 400 }))
  })

  it('returns 400 for an invalid reset token', async () => {
    ;(authService.resetPassword as any).mockRejectedValue(
      new AppError('Token is invalid or has expired', 400),
    )
    const req = makeReq({ token: 'tampered-token', password: 'new-secure-password' })
    const res = makeRes()

    await resetPassword(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
  })
})
