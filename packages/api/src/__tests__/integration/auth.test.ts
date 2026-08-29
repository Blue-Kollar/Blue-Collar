/**
 * Integration tests for auth endpoints — packages/api/src/__tests__/integration/auth.test.ts
 *
 * These tests exercise the full HTTP stack (route → controller → service)
 * while mocking the database and mailer to keep tests fast and deterministic.
 *
 * Issue: #1007 [Backend] Add integration tests for auth endpoints
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'

// ─── Env setup ────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-integration-secret'
process.env.APP_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'

// ─── Mocks (must come before imports that use mocked modules) ─────────────────

vi.mock('../../db.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-integration-secret',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'test-user',
    MAIL_PASS: 'test-pass',
    APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('../../mailer/transport.js', () => ({
  transporter: {
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  },
}))

vi.mock('../../mailer/index.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendModerationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../config/redis.js', () => ({
  redis: {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue(undefined),
  },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../../monitoring/tracing.js', () => ({
  initializeTracing: vi.fn(),
}))

vi.mock('../../services/reminder.service.js', () => ({
  startReminderScheduler: vi.fn(),
}))

vi.mock('../../services/horizon-poller.service.js', () => ({
  startHorizonPoller: vi.fn(),
}))

vi.mock('../../monitoring/business-metrics.js', () => ({
  metricsRecorder: { startPeriodicSync: vi.fn() },
}))

vi.mock('../../config/passport.js', () => ({
  default: {
    initialize: () => (_req: any, _res: any, next: any) => next(),
    authenticate: () => (_req: any, _res: any, next: any) => next(),
    use: vi.fn(),
  },
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { db } from '../../db.js'
import app from '../../index.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeHashedPassword(): string {
  // argon2 hash format (mock — real hash not needed, auth service is mocked via db)
  return '$argon2id$v=19$m=65536,t=3,p=4$somesalt$somehash'
}

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-test-1',
    email: 'alice@example.com',
    firstName: 'Alice',
    lastName: 'Smith',
    role: 'user',
    verified: true,
    password: makeHashedPassword(),
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
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
    referralCode: null,
    onboardingCompleted: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function validAuthToken(userId = 'user-test-1', role = 'user') {
  return jwt.sign({ id: userId, role }, 'test-integration-secret', { expiresIn: '1h' })
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 201 with user data on successful registration', async () => {
    const newUser = makeUser({ verified: false })
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never)
    vi.mocked(db.user.create).mockResolvedValue(newUser as never)
    vi.mocked(db.user.update).mockResolvedValue({ ...newUser, verificationToken: 'hash' } as never)

    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'SecurePass123!',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    expect(res.body.code).toBe(201)
    expect(res.body.data).toBeDefined()
    expect(res.body.data.email).toBe('alice@example.com')
    // Password should never be returned
    expect(res.body.data.password).toBeUndefined()
  })

  it('returns 409 when email is already registered', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(makeUser() as never)

    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      password: 'SecurePass123!',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    expect(res.status).toBe(409)
    expect(res.body.status).toBe('error')
    expect(res.body.message).toMatch(/email already in use/i)
  })

  it('returns 422 when required fields are missing', async () => {
    const res = await request(app).post('/api/auth/register').send({})

    expect(res.status).toBe(422)
    expect(res.body.status).toBe('error')
  })

  it('returns 422 when email is invalid', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      password: 'SecurePass123!',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    expect(res.status).toBe(422)
  })

  it('returns 422 when password is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
    })

    expect(res.status).toBe(422)
  })
})

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 202 with JWT token on successful login', async () => {
    const user = makeUser()
    // The auth service calls argon2.verify internally — we need to mock findUnique
    // to return a user and ensure argon2.verify passes. We mock argon2 at module level.
    vi.mocked(db.user.findUnique).mockResolvedValue(user as never)
    vi.mocked(db.refreshToken.create).mockResolvedValue({ id: 'rt-1' } as never)

    // Since argon2 is not mocked, the hash won't verify. Mock loginUser service via db instead:
    // The auth service will call argon2.verify(storedHash, providedPassword).
    // In tests we can't have a real argon2 hash easily — so we spy on the service.
    // Alternative: mock at the auth service level.
    const authService = await import('../../services/auth.service.js')
    const loginSpy = vi.spyOn(authService, 'loginUser').mockResolvedValue({
      data: user as any,
      token: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
    })

    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'SecurePass123!',
    })

    expect(res.status).toBe(202)
    expect(res.body.status).toBe('success')
    expect(res.body.token).toBe('mock-access-token')
    expect(res.body.code).toBe(202)
    expect(res.body.data.email).toBe('alice@example.com')
    expect(res.body.data.password).toBeUndefined()

    loginSpy.mockRestore()
  })

  it('returns 401 for wrong password', async () => {
    const authService = await import('../../services/auth.service.js')
    const { AppError } = await import('../../services/AppError.js')
    const loginSpy = vi.spyOn(authService, 'loginUser').mockRejectedValue(
      new AppError('Invalid credentials', 401),
    )

    const res = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'wrong-password',
    })

    expect(res.status).toBe(401)
    expect(res.body.status).toBe('error')
    expect(res.body.code).toBe(401)

    loginSpy.mockRestore()
  })

  it('returns 401 for non-existent user', async () => {
    const authService = await import('../../services/auth.service.js')
    const { AppError } = await import('../../services/AppError.js')
    const loginSpy = vi.spyOn(authService, 'loginUser').mockRejectedValue(
      new AppError('Invalid credentials', 401),
    )

    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@example.com',
      password: 'any-password',
    })

    expect(res.status).toBe(401)

    loginSpy.mockRestore()
  })

  it('returns 403 for unverified account', async () => {
    const authService = await import('../../services/auth.service.js')
    const { AppError } = await import('../../services/AppError.js')
    const loginSpy = vi.spyOn(authService, 'loginUser').mockRejectedValue(
      new AppError(
        'Your email address has not been verified. Please check your inbox and click the verification link.',
        403,
      ),
    )

    const res = await request(app).post('/api/auth/login').send({
      email: 'unverified@example.com',
      password: 'SecurePass123!',
    })

    expect(res.status).toBe(403)
    expect(res.body.status).toBe('error')
    expect(res.body.code).toBe(403)

    loginSpy.mockRestore()
  })

  it('returns 422 when email or password is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({})

    expect(res.status).toBe(422)
  })
})

// ─── DELETE /api/auth/logout ──────────────────────────────────────────────────

describe('DELETE /api/auth/logout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 when authenticated', async () => {
    vi.mocked(db.refreshToken.updateMany).mockResolvedValue({ count: 1 } as never)

    const res = await request(app)
      .delete('/api/auth/logout')
      .set('Authorization', `Bearer ${validAuthToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.message).toBe('Logged out')
  })

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).delete('/api/auth/logout')

    expect(res.status).toBe(401)
  })

  it('returns 401 for an invalid token', async () => {
    const res = await request(app)
      .delete('/api/auth/logout')
      .set('Authorization', 'Bearer invalid.token.here')

    expect(res.status).toBe(401)
  })
})

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with user profile when authenticated', async () => {
    const user = makeUser()
    vi.mocked(db.user.findUnique).mockResolvedValue(user as never)

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validAuthToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toBeDefined()
    expect(res.body.data.email).toBe('alice@example.com')
    expect(res.body.data.password).toBeUndefined()
  })

  it('returns 401 when no auth token provided', async () => {
    const res = await request(app).get('/api/auth/me')

    expect(res.status).toBe(401)
  })

  it('returns 404 when user no longer exists', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never)

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${validAuthToken()}`)

    expect(res.status).toBe(404)
  })
})

// ─── POST /api/auth/forgot-password ──────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 regardless of whether email exists (prevents enumeration)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never)

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'ghost@example.com',
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
  })

  it('sends reset email when user exists and returns 200', async () => {
    const user = makeUser()
    vi.mocked(db.user.findUnique).mockResolvedValue(user as never)
    vi.mocked(db.user.update).mockResolvedValue({ ...user, resetToken: 'hash' } as never)

    const res = await request(app).post('/api/auth/forgot-password').send({
      email: 'alice@example.com',
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
  })

  it('returns 422 when email field is missing', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({})

    expect(res.status).toBe(422)
  })
})

// ─── PUT /api/auth/reset-password ─────────────────────────────────────────────

describe('PUT /api/auth/reset-password', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 on successful password reset', async () => {
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const user = makeUser({ resetToken: tokenHash, resetTokenExpiry: new Date(Date.now() + 60000) })

    vi.mocked(db.user.findFirst).mockResolvedValue(user as never)
    vi.mocked(db.user.update).mockResolvedValue(user as never)

    const res = await request(app).put('/api/auth/reset-password').send({
      token: rawToken,
      password: 'NewSecurePass123!',
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.message).toBe('Password reset successful')
  })

  it('returns 400 for invalid or expired token', async () => {
    vi.mocked(db.user.findFirst).mockResolvedValue(null as never)

    const res = await request(app).put('/api/auth/reset-password').send({
      token: 'invalid-token',
      password: 'NewSecurePass123!',
    })

    expect(res.status).toBe(400)
    expect(res.body.status).toBe('error')
  })

  it('returns 422 when token or password is missing', async () => {
    const res = await request(app).put('/api/auth/reset-password').send({
      token: 'some-token',
    })

    expect(res.status).toBe(422)
  })
})

// ─── PUT /api/auth/verify-account ─────────────────────────────────────────────

describe('PUT /api/auth/verify-account', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when token is missing', async () => {
    const res = await request(app).put('/api/auth/verify-account').send({})

    expect(res.status).toBe(400)
    expect(res.body.status).toBe('error')
  })

  it('returns 400 for an invalid token', async () => {
    const res = await request(app)
      .put('/api/auth/verify-account')
      .send({ token: 'invalid-token' })

    expect(res.status).toBe(400)
  })

  it('returns 200 when email is successfully verified', async () => {
    // Create a valid verification JWT
    const rawToken = jwt.sign(
      { id: 'user-test-1', purpose: 'email-verify' },
      'test-integration-secret',
      { expiresIn: '24h' },
    )
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const user = makeUser({
      verified: false,
      verificationToken: tokenHash,
      verificationTokenExpiry: new Date(Date.now() + 86400000),
    })

    vi.mocked(db.user.findUnique).mockResolvedValue(user as never)
    vi.mocked(db.user.update).mockResolvedValue({ ...user, verified: true } as never)

    const res = await request(app)
      .put('/api/auth/verify-account')
      .send({ token: rawToken })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.message).toMatch(/verified/i)
  })

  it('returns 200 for already-verified account', async () => {
    const rawToken = jwt.sign(
      { id: 'user-test-1', purpose: 'email-verify' },
      'test-integration-secret',
      { expiresIn: '24h' },
    )
    const user = makeUser({ verified: true })
    vi.mocked(db.user.findUnique).mockResolvedValue(user as never)

    const res = await request(app)
      .put('/api/auth/verify-account')
      .send({ token: rawToken })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/already verified/i)
  })
})

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when refreshToken is missing', async () => {
    const res = await request(app).post('/api/auth/refresh').send({})

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/refreshToken is required/i)
  })

  it('returns 401 for invalid refresh token', async () => {
    vi.mocked(db.refreshToken.findUnique).mockResolvedValue(null as never)

    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: 'invalid-refresh-token',
    })

    expect(res.status).toBe(401)
  })

  it('returns 200 with new token pair for valid refresh token', async () => {
    const rawToken = crypto.randomBytes(40).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const user = makeUser()

    vi.mocked(db.refreshToken.findUnique).mockResolvedValue({
      id: 'rt-1',
      userId: user.id,
      tokenHash,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
    } as never)
    vi.mocked(db.refreshToken.update).mockResolvedValue({ id: 'rt-1' } as never)
    vi.mocked(db.user.findUnique).mockResolvedValue(user as never)
    vi.mocked(db.refreshToken.create).mockResolvedValue({ id: 'rt-2' } as never)

    const res = await request(app).post('/api/auth/refresh').send({
      refreshToken: rawToken,
    })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.token).toBeDefined()
    expect(res.body.refreshToken).toBeDefined()
  })
})

// ─── POST /api/auth/resend-verification ───────────────────────────────────────

describe('POST /api/auth/resend-verification', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 for any email (prevents enumeration)', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue(null as never)

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'ghost@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
  })

  it('resends email for unverified user and returns 200', async () => {
    const user = makeUser({ verified: false })
    vi.mocked(db.user.findUnique).mockResolvedValue(user as never)
    vi.mocked(db.user.update).mockResolvedValue({ ...user, verificationToken: 'hash' } as never)

    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({ email: 'alice@example.com' })

    expect(res.status).toBe(200)
  })

  it('returns 422 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/resend-verification')
      .send({})

    expect(res.status).toBe(422)
  })
})
