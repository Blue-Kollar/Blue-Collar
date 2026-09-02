import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '../db.js'
import { sendVerificationEmail } from '../mailer/index.js'
import { updateProfile } from './user.service.js'

vi.mock('../db.js', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../mailer/index.js', () => ({
  sendVerificationEmail: vi.fn(),
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(() => 'verification-token'),
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

const currentUser = {
  id: '1',
  email: 'old@x.com',
  password: 'hash',
  firstName: 'Old',
  lastName: 'Name',
  role: 'user',
  googleId: null,
  walletAddress: null,
  avatar: null,
  bio: null,
  phone: null,
  verified: true,
  verificationToken: null,
  verificationTokenExpiry: null,
  resetToken: null,
  resetTokenExpiry: null,
  twoFactorSecret: null,
  twoFactorEnabled: false,
  twoFactorBackupCodes: [],
  referralCode: null,
  locationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('updateProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
    vi.mocked(db.user.findUnique).mockResolvedValue(currentUser as any)
    vi.mocked(db.user.update).mockImplementation(async ({ data }: any) => ({ ...currentUser, ...data }))
  })

  it('returns updated user without password hash', async () => {
    const result = await updateProfile('1', { firstName: 'New', lastName: 'Name' })

    expect(result).not.toHaveProperty('password')
    expect(result.firstName).toBe('New')
  })

  it('throws a ZodError on invalid email', async () => {
    await expect(updateProfile('1', { email: 'not-an-email' })).rejects.toThrow()
  })

  it('marks verified false and sends verification when email changes', async () => {
    const result = await updateProfile('1', { email: 'new@x.com' })

    expect(result.verified).toBe(false)
    expect(db.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@x.com',
          verified: false,
          verificationToken: expect.any(String),
          verificationTokenExpiry: expect.any(Date),
        }),
      }),
    )
    expect(sendVerificationEmail).toHaveBeenCalledWith('new@x.com', 'Old', 'verification-token')
  })
})
