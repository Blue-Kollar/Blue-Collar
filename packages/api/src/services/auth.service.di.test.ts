/**
 * Auth service tests using the dependency injection pattern.
 *
 * Injects mock dependencies directly — no vi.mock() of entire modules required.
 * See docs/DI_PATTERN.md for the full guide.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAuthService } from './auth.service.js'
import { AppError } from './AppError.js'

// ── Stub heavy dependencies ───────────────────────────────────────────────────

vi.mock('argon2', () => ({
  default: {
    verify: vi.fn().mockResolvedValue(true),
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'stub-jwt'),
    verify: vi.fn((token: string) => {
      if (token === 'invalid') throw new Error('invalid token')
      return { id: 'user-1', purpose: 'email-verify' }
    }),
  },
}))

vi.mock('../utils/logger.js', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}))

vi.mock('../models/user.model.js', () => ({
  sanitizeUser: (u: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safe } = u
    return safe
  },
}))

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseUser = {
  id: 'user-1',
  email: 'alice@example.com',
  password: 'hashed',
  firstName: 'Alice',
  lastName: 'Smith',
  role: 'user',
  verified: true,
  googleId: null,
  walletAddress: null,
  avatar: null,
  bio: null,
  phone: null,
  verificationToken: 'token-hash',
  verificationTokenExpiry: new Date(Date.now() + 60_000),
  resetToken: null,
  resetTokenExpiry: null,
  twoFactorSecret: null,
  twoFactorEnabled: false,
  twoFactorBackupCodes: [],
  referralCode: null,
  locationId: null,
  onboardingCompleted: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const makeMockRepo = () => ({
  findById: vi.fn(),
  findAll: vi.fn(),
  findByEmail: vi.fn(),
  findByGoogleId: vi.fn(),
  findByResetToken: vi.fn(),
  findByVerificationToken: vi.fn(),
  findByReferralCode: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
})

const makeMockMailer = () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
})

const makeMockDb = () => ({
  refreshToken: {
    create: vi.fn().mockResolvedValue({ id: 'rt-1' }),
    findUnique: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
  device: {
    create: vi.fn().mockResolvedValue({ id: 'dev-1' }),
    updateMany: vi.fn().mockResolvedValue({ count: 1 }),
  },
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createAuthService (DI)', () => {
  let mockRepo: ReturnType<typeof makeMockRepo>
  let mockMailer: ReturnType<typeof makeMockMailer>
  let mockDb: ReturnType<typeof makeMockDb>

  beforeEach(() => {
    mockRepo = makeMockRepo()
    mockMailer = makeMockMailer()
    mockDb = makeMockDb()
    process.env.JWT_SECRET = 'test-secret'
  })

  // ── loginUser ───────────────────────────────────────────────────────────────

  describe('loginUser', () => {
    it('returns user data and tokens on successful login', async () => {
      mockRepo.findByEmail.mockResolvedValue(baseUser)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      const result = await svc.loginUser({ email: 'alice@example.com', password: 'password' })

      expect(result.data).not.toHaveProperty('password')
      expect(result.token).toBe('stub-jwt')
      expect(result.refreshToken).toBeDefined()
      expect(mockDb.refreshToken.create).toHaveBeenCalledOnce()
    })

    it('throws AppError 401 when user not found', async () => {
      mockRepo.findByEmail.mockResolvedValue(null)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await expect(
        svc.loginUser({ email: 'ghost@example.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(AppError)
    })

    it('throws AppError 403 when email is not verified', async () => {
      mockRepo.findByEmail.mockResolvedValue({ ...baseUser, verified: false })
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await expect(
        svc.loginUser({ email: 'alice@example.com', password: 'password' }),
      ).rejects.toMatchObject({ statusCode: 403 })
    })

    it('creates a device record when deviceName and ipAddress are supplied', async () => {
      mockRepo.findByEmail.mockResolvedValue(baseUser)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      const result = await svc.loginUser(
        { email: 'alice@example.com', password: 'password' },
        'Chrome',
        'Mozilla/5.0',
        '127.0.0.1',
      )

      expect(mockDb.device.create).toHaveBeenCalledOnce()
      expect(result.deviceId).toBe('dev-1')
    })
  })

  // ── registerUser ────────────────────────────────────────────────────────────

  describe('registerUser', () => {
    it('creates user and sends verification email', async () => {
      mockRepo.findByEmail.mockResolvedValue(null)
      mockRepo.create.mockResolvedValue(baseUser)
      mockRepo.update.mockResolvedValue(baseUser)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      const result = await svc.registerUser({
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
      })

      expect(result).not.toHaveProperty('password')
      expect(mockMailer.sendVerificationEmail).toHaveBeenCalledOnce()
    })

    it('throws AppError 409 when email already exists', async () => {
      mockRepo.findByEmail.mockResolvedValue(baseUser)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await expect(
        svc.registerUser({
          email: 'alice@example.com',
          password: 'password123',
          firstName: 'Alice',
          lastName: 'Smith',
        }),
      ).rejects.toMatchObject({ statusCode: 409 })

      expect(mockRepo.create).not.toHaveBeenCalled()
    })
  })

  // ── revokeAllRefreshTokens ──────────────────────────────────────────────────

  describe('revokeAllRefreshTokens', () => {
    it('calls db.refreshToken.updateMany to revoke tokens', async () => {
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await svc.revokeAllRefreshTokens('user-1')

      expect(mockDb.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: 'user-1' }) }),
      )
    })
  })

  // ── requestPasswordReset ────────────────────────────────────────────────────

  describe('requestPasswordReset', () => {
    it('stores reset token and sends email when user exists', async () => {
      mockRepo.findByEmail.mockResolvedValue(baseUser)
      mockRepo.update.mockResolvedValue(baseUser)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await svc.requestPasswordReset('alice@example.com')

      expect(mockRepo.update).toHaveBeenCalledOnce()
      expect(mockMailer.sendPasswordResetEmail).toHaveBeenCalledOnce()
    })

    it('silently no-ops when user does not exist', async () => {
      mockRepo.findByEmail.mockResolvedValue(null)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await expect(svc.requestPasswordReset('nobody@example.com')).resolves.toBeUndefined()

      expect(mockMailer.sendPasswordResetEmail).not.toHaveBeenCalled()
    })
  })

  // ── resetPassword ───────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('updates password and revokes all sessions', async () => {
      mockRepo.findByResetToken.mockResolvedValue(baseUser)
      mockRepo.update.mockResolvedValue(baseUser)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await svc.resetPassword('raw-token', 'newpassword123')

      expect(mockDb.refreshToken.updateMany).toHaveBeenCalledOnce()
      expect(mockDb.device.updateMany).toHaveBeenCalledOnce()
      expect(mockRepo.update).toHaveBeenCalledOnce()
    })

    it('throws AppError 400 when token is invalid', async () => {
      mockRepo.findByResetToken.mockResolvedValue(null)
      const svc = createAuthService({ userRepository: mockRepo, mailer: mockMailer, db: mockDb })

      await expect(svc.resetPassword('bad-token', 'newpassword123')).rejects.toMatchObject({
        statusCode: 400,
      })
    })
  })
})
