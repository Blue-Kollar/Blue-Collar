/**
 * User service tests using the dependency injection pattern.
 *
 * Injects mock dependencies directly — no vi.mock() required.
 * See docs/DI_PATTERN.md for the full guide.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createUserService } from './user.service.js'
import { AppError } from './AppError.js'

// Stub JWT sign so no real secret is needed
vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'stub-token'),
    verify: vi.fn(),
  },
}))

vi.mock('../models/user.model.js', () => ({
  sanitizeUser: (u: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _pw, ...safe } = u
    return safe
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
  verificationToken: null,
  verificationTokenExpiry: null,
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

describe('createUserService (DI)', () => {
  let mockRepo: ReturnType<typeof makeMockRepo>
  let mockMailer: ReturnType<typeof makeMockMailer>

  beforeEach(() => {
    mockRepo = makeMockRepo()
    mockMailer = makeMockMailer()
    process.env.JWT_SECRET = 'test-secret'
  })

  describe('updateProfile', () => {
    it('updates name without email change', async () => {
      mockRepo.findById.mockResolvedValue(baseUser)
      mockRepo.update.mockResolvedValue({ ...baseUser, firstName: 'Alicia' })
      const svc = createUserService({ userRepository: mockRepo, mailer: mockMailer })

      const result = await svc.updateProfile('user-1', { firstName: 'Alicia' })

      expect(result).not.toHaveProperty('password')
      expect(result).toMatchObject({ firstName: 'Alicia' })
      expect(mockMailer.sendVerificationEmail).not.toHaveBeenCalled()
    })

    it('sends verification email when email changes', async () => {
      mockRepo.findById.mockResolvedValue(baseUser)
      mockRepo.update.mockResolvedValue({ ...baseUser, email: 'new@example.com', verified: false })
      const svc = createUserService({ userRepository: mockRepo, mailer: mockMailer })

      await svc.updateProfile('user-1', { email: 'new@example.com' })

      expect(mockMailer.sendVerificationEmail).toHaveBeenCalledWith(
        'new@example.com',
        baseUser.firstName,
        expect.any(String),
      )
    })

    it('throws AppError 404 when user not found', async () => {
      mockRepo.findById.mockResolvedValue(null)
      const svc = createUserService({ userRepository: mockRepo, mailer: mockMailer })

      await expect(svc.updateProfile('missing', { firstName: 'X' })).rejects.toBeInstanceOf(AppError)
    })

    it('throws on invalid email', async () => {
      const svc = createUserService({ userRepository: mockRepo, mailer: mockMailer })
      await expect(svc.updateProfile('user-1', { email: 'not-an-email' })).rejects.toThrow()
    })
  })

  describe('deleteAccount', () => {
    it('delegates to userRepository.delete', async () => {
      mockRepo.delete.mockResolvedValue(baseUser)
      const svc = createUserService({ userRepository: mockRepo, mailer: mockMailer })

      await svc.deleteAccount('user-1')

      expect(mockRepo.delete).toHaveBeenCalledWith('user-1')
    })
  })
})
