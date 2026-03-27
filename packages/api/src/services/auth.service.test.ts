import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { AppError } from './AppError.js'
import * as authService from './auth.service.js'

// Mock dependencies
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

vi.mock('argon2', () => ({
  default: {
    hash: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}))

vi.mock('../mailer/index.js', () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))

vi.mock('../models/user.model.js', () => ({
  sanitizeUser: (user: any) => {
    const { password, resetToken, resetTokenExpiry, verificationToken, verificationTokenExpiry, ...safe } = user
    return safe
  },
}))

vi.mock('../config/logger.js', () => ({
  logger: {
    error: vi.fn(),
  },
}))

import { db } from '../db.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../mailer/index.js'

const mockDb = db as any
const mockArgon2 = argon2 as any
const mockJwt = jwt as any
const mockMailer = {
  sendVerificationEmail: sendVerificationEmail as any,
  sendPasswordResetEmail: sendPasswordResetEmail as any,
}

// Helper to create mock user data
function createMockUser(overrides = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    password: 'hashed-password',
    firstName: 'John',
    lastName: 'Doe',
    role: 'user',
    verified: true,
    verificationToken: null,
    verificationTokenExpiry: null,
    resetToken: null,
    resetTokenExpiry: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.JWT_SECRET = 'test-secret'
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── loginUser ────────────────────────────────────────────────────────────────

describe('loginUser', () => {
  it('returns user and token on successful login', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockArgon2.verify.mockResolvedValue(true)
    mockJwt.sign.mockReturnValue('jwt-token')

    const result = await authService.loginUser({ email: 'user@example.com', password: 'password' })

    expect(result.token).toBe('jwt-token')
    expect(result.data).toEqual(expect.objectContaining({ email: 'user@example.com' }))
    expect(mockDb.user.findUnique).toHaveBeenCalledWith({ where: { email: 'user@example.com' } })
    expect(mockArgon2.verify).toHaveBeenCalledWith('hashed-password', 'password')
  })

  it('throws 401 when user not found', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)

    await expect(authService.loginUser({ email: 'nonexistent@example.com', password: 'password' })).rejects.toThrow(
      AppError,
    )
    await expect(authService.loginUser({ email: 'nonexistent@example.com', password: 'password' })).rejects.toMatchObject(
      {
        message: 'Invalid credentials',
        statusCode: 401,
      },
    )
  })

  it('throws 401 when password is incorrect', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockArgon2.verify.mockResolvedValue(false)

    await expect(authService.loginUser({ email: 'user@example.com', password: 'wrong-password' })).rejects.toThrow(
      AppError,
    )
    await expect(authService.loginUser({ email: 'user@example.com', password: 'wrong-password' })).rejects.toMatchObject(
      {
        message: 'Invalid credentials',
        statusCode: 401,
      },
    )
  })

  it('throws 401 when user has no password', async () => {
    const mockUser = createMockUser({ password: null })
    mockDb.user.findUnique.mockResolvedValue(mockUser)

    await expect(authService.loginUser({ email: 'user@example.com', password: 'password' })).rejects.toThrow(AppError)
    await expect(authService.loginUser({ email: 'user@example.com', password: 'password' })).rejects.toMatchObject({
      message: 'Invalid credentials',
      statusCode: 401,
    })
  })

  it('throws 403 when email is not verified', async () => {
    const mockUser = createMockUser({ verified: false })
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockArgon2.verify.mockResolvedValue(true)

    await expect(authService.loginUser({ email: 'user@example.com', password: 'password' })).rejects.toThrow(AppError)
    await expect(authService.loginUser({ email: 'user@example.com', password: 'password' })).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('generates JWT token with correct payload', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockArgon2.verify.mockResolvedValue(true)
    mockJwt.sign.mockReturnValue('jwt-token')

    await authService.loginUser({ email: 'user@example.com', password: 'password' })

    expect(mockJwt.sign).toHaveBeenCalledWith(
      { id: 'user-1', role: 'user' },
      'test-secret',
      { expiresIn: '7d' },
    )
  })
})

// ── registerUser ─────────────────────────────────────────────────────────────

describe('registerUser', () => {
  it('creates a new user and sends verification email', async () => {
    const mockUser = createMockUser({ verified: false })
    mockDb.user.create.mockResolvedValue(mockUser)
    mockDb.user.update.mockResolvedValue(mockUser)
    mockArgon2.hash.mockResolvedValue('hashed-password')
    mockJwt.sign.mockReturnValue('verification-token')
    mockMailer.sendVerificationEmail.mockResolvedValue(undefined)

    const result = await authService.registerUser({
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    })

    expect(result).toEqual(expect.objectContaining({ email: 'newuser@example.com' }))
    expect(mockDb.user.create).toHaveBeenCalledWith({
      data: {
        email: 'newuser@example.com',
        password: 'hashed-password',
        firstName: 'John',
        lastName: 'Doe',
      },
    })
    expect(mockMailer.sendVerificationEmail).toHaveBeenCalled()
  })

  it('throws 409 when email already exists', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(mockUser)

    await expect(
      authService.registerUser({
        email: 'user@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      }),
    ).rejects.toThrow(AppError)
    await expect(
      authService.registerUser({
        email: 'user@example.com',
        password: 'password123',
        firstName: 'John',
        lastName: 'Doe',
      }),
    ).rejects.toMatchObject({
      message: 'Email already in use',
      statusCode: 409,
    })
  })

  it('hashes password before storing', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue(mockUser)
    mockDb.user.update.mockResolvedValue(mockUser)
    mockArgon2.hash.mockResolvedValue('hashed-password')
    mockJwt.sign.mockReturnValue('verification-token')

    await authService.registerUser({
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    })

    expect(mockArgon2.hash).toHaveBeenCalledWith('password123')
  })

  it('stores verification token and expiry', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(null)
    mockDb.user.create.mockResolvedValue(mockUser)
    mockDb.user.update.mockResolvedValue(mockUser)
    mockArgon2.hash.mockResolvedValue('hashed-password')
    mockJwt.sign.mockReturnValue('verification-token')

    await authService.registerUser({
      email: 'newuser@example.com',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
    })

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        verificationToken: expect.any(String),
        verificationTokenExpiry: expect.any(Date),
      }),
    })
  })
})

// ── verifyAccount ────────────────────────────────────────────────────────────

describe('verifyAccount', () => {
  it('verifies account with valid token', async () => {
    const mockUser = createMockUser({ verified: false })
    const token = 'valid-token'
    const hash = crypto.createHash('sha256').update(token).digest('hex')

    mockJwt.verify.mockReturnValue({ id: 'user-1', purpose: 'email-verify' })
    mockDb.user.findUnique.mockResolvedValue({
      ...mockUser,
      verificationToken: hash,
      verificationTokenExpiry: new Date(Date.now() + 1000),
    })
    mockDb.user.update.mockResolvedValue({ ...mockUser, verified: true })

    const result = await authService.verifyAccount(token)

    expect(result).toBe(true)
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        verified: true,
        verificationToken: null,
        verificationTokenExpiry: null,
      },
    })
  })

  it('throws 400 when token is invalid', async () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('Invalid token')
    })

    await expect(authService.verifyAccount('invalid-token')).rejects.toThrow(AppError)
    await expect(authService.verifyAccount('invalid-token')).rejects.toMatchObject({
      message: 'Token is invalid or has expired',
      statusCode: 400,
    })
  })

  it('throws 400 when token purpose is not email-verify', async () => {
    mockJwt.verify.mockReturnValue({ id: 'user-1', purpose: 'wrong-purpose' })

    await expect(authService.verifyAccount('token')).rejects.toThrow(AppError)
    await expect(authService.verifyAccount('token')).rejects.toMatchObject({
      message: 'Invalid verification token',
      statusCode: 400,
    })
  })

  it('throws 404 when user not found', async () => {
    mockJwt.verify.mockReturnValue({ id: 'nonexistent', purpose: 'email-verify' })
    mockDb.user.findUnique.mockResolvedValue(null)

    await expect(authService.verifyAccount('token')).rejects.toThrow(AppError)
    await expect(authService.verifyAccount('token')).rejects.toMatchObject({
      message: 'User not found',
      statusCode: 404,
    })
  })

  it('returns false when user already verified', async () => {
    const mockUser = createMockUser({ verified: true })
    mockJwt.verify.mockReturnValue({ id: 'user-1', purpose: 'email-verify' })
    mockDb.user.findUnique.mockResolvedValue(mockUser)

    const result = await authService.verifyAccount('token')

    expect(result).toBe(false)
    expect(mockDb.user.update).not.toHaveBeenCalled()
  })

  it('throws 400 when token hash does not match', async () => {
    const mockUser = createMockUser({ verified: false, verificationToken: 'different-hash' })
    mockJwt.verify.mockReturnValue({ id: 'user-1', purpose: 'email-verify' })
    mockDb.user.findUnique.mockResolvedValue(mockUser)

    await expect(authService.verifyAccount('token')).rejects.toThrow(AppError)
    await expect(authService.verifyAccount('token')).rejects.toMatchObject({
      message: 'Token is invalid or has expired',
      statusCode: 400,
    })
  })

  it('throws 400 when token has expired', async () => {
    const token = 'valid-token'
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const mockUser = createMockUser({
      verified: false,
      verificationToken: hash,
      verificationTokenExpiry: new Date(Date.now() - 1000), // Expired
    })

    mockJwt.verify.mockReturnValue({ id: 'user-1', purpose: 'email-verify' })
    mockDb.user.findUnique.mockResolvedValue(mockUser)

    await expect(authService.verifyAccount(token)).rejects.toThrow(AppError)
    await expect(authService.verifyAccount(token)).rejects.toMatchObject({
      message: 'Token is invalid or has expired',
      statusCode: 400,
    })
  })
})

// ── requestPasswordReset ─────────────────────────────────────────────────────

describe('requestPasswordReset', () => {
  it('sends password reset email when user exists', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockDb.user.update.mockResolvedValue(mockUser)
    mockMailer.sendPasswordResetEmail.mockResolvedValue(undefined)

    await authService.requestPasswordReset('user@example.com')

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        resetToken: expect.any(String),
        resetTokenExpiry: expect.any(Date),
      }),
    })
    expect(mockMailer.sendPasswordResetEmail).toHaveBeenCalled()
  })

  it('does not throw when user does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)

    await expect(authService.requestPasswordReset('nonexistent@example.com')).resolves.not.toThrow()
  })

  it('does not send email when user does not exist', async () => {
    mockDb.user.findUnique.mockResolvedValue(null)

    await authService.requestPasswordReset('nonexistent@example.com')

    expect(mockMailer.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('stores reset token with 1 hour expiry', async () => {
    const mockUser = createMockUser()
    mockDb.user.findUnique.mockResolvedValue(mockUser)
    mockDb.user.update.mockResolvedValue(mockUser)

    const beforeTime = Date.now()
    await authService.requestPasswordReset('user@example.com')
    const afterTime = Date.now()

    const updateCall = mockDb.user.update.mock.calls[0][0]
    const expiryTime = updateCall.data.resetTokenExpiry.getTime()

    expect(expiryTime).toBeGreaterThanOrEqual(beforeTime + 60 * 60 * 1000 - 100)
    expect(expiryTime).toBeLessThanOrEqual(afterTime + 60 * 60 * 1000 + 100)
  })
})

// ── resetPassword ────────────────────────────────────────────────────────────

describe('resetPassword', () => {
  it('resets password with valid token', async () => {
    const token = 'reset-token'
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const mockUser = createMockUser({ resetToken: hash, resetTokenExpiry: new Date(Date.now() + 1000) })

    mockDb.user.findFirst.mockResolvedValue(mockUser)
    mockArgon2.hash.mockResolvedValue('new-hashed-password')
    mockDb.user.update.mockResolvedValue(mockUser)

    await authService.resetPassword(token, 'new-password')

    expect(mockArgon2.hash).toHaveBeenCalledWith('new-password')
    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        password: 'new-hashed-password',
        resetToken: null,
        resetTokenExpiry: null,
      },
    })
  })

  it('throws 400 when token is invalid', async () => {
    mockDb.user.findFirst.mockResolvedValue(null)

    await expect(authService.resetPassword('invalid-token', 'new-password')).rejects.toThrow(AppError)
    await expect(authService.resetPassword('invalid-token', 'new-password')).rejects.toMatchObject({
      message: 'Token is invalid or has expired',
      statusCode: 400,
    })
  })

  it('throws 400 when token has expired', async () => {
    const token = 'expired-token'
    const hash = crypto.createHash('sha256').update(token).digest('hex')

    mockDb.user.findFirst.mockResolvedValue(null) // No user with valid token

    await expect(authService.resetPassword(token, 'new-password')).rejects.toThrow(AppError)
    await expect(authService.resetPassword(token, 'new-password')).rejects.toMatchObject({
      message: 'Token is invalid or has expired',
      statusCode: 400,
    })
  })

  it('hashes new password before storing', async () => {
    const token = 'reset-token'
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const mockUser = createMockUser({ resetToken: hash, resetTokenExpiry: new Date(Date.now() + 1000) })

    mockDb.user.findFirst.mockResolvedValue(mockUser)
    mockArgon2.hash.mockResolvedValue('new-hashed-password')
    mockDb.user.update.mockResolvedValue(mockUser)

    await authService.resetPassword(token, 'new-password')

    expect(mockArgon2.hash).toHaveBeenCalledWith('new-password')
  })

  it('clears reset token after successful reset', async () => {
    const token = 'reset-token'
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const mockUser = createMockUser({ resetToken: hash, resetTokenExpiry: new Date(Date.now() + 1000) })

    mockDb.user.findFirst.mockResolvedValue(mockUser)
    mockArgon2.hash.mockResolvedValue('new-hashed-password')
    mockDb.user.update.mockResolvedValue(mockUser)

    await authService.resetPassword(token, 'new-password')

    expect(mockDb.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        resetToken: null,
        resetTokenExpiry: null,
      }),
    })
  })
})
