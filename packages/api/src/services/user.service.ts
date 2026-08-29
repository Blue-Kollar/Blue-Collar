import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import { z } from 'zod'
import { db } from '../db.js'
import { sendVerificationEmail } from '../mailer/index.js'
import { sanitizeUser } from '../models/user.model.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { createServiceLogger } from '../utils/logger.js'
import { userRepository as defaultUserRepository } from '../repositories/user.repository.js'
import type { UserServiceDeps } from '../container/types.js'

const logger = createServiceLogger('UserService')

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
})

function generateVerificationToken(userId: string) {
  const raw = jwt.sign({ id: userId, purpose: 'email-verify' }, process.env.JWT_SECRET!, {
    expiresIn: '24h',
  })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return { raw, hash, expiry }
}

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

// ── Service factory ──────────────────────────────────────────────────────────

/**
 * Create a user service with injected dependencies.
 *
 * This enables clean unit testing without module-level mocking:
 *
 * ```ts
 * const mockRepo = { findById: vi.fn(), update: vi.fn(), delete: vi.fn(), ... }
 * const mockMailer = { sendVerificationEmail: vi.fn() }
 * const svc = createUserService({ userRepository: mockRepo, mailer: mockMailer })
 * await svc.updateProfile('user-1', { firstName: 'Alice' })
 * expect(mockRepo.findById).toHaveBeenCalledWith('user-1')
 * ```
 */
export function createUserService(deps: UserServiceDeps) {
  const { userRepository: repo, mailer } = deps

  return {
    async updateProfile(userId: string, input: UpdateProfileInput) {
      logger.debug('Updating user profile', { userId })
      const parsed = updateProfileSchema.parse(input)
      const current = await repo.findById(userId)
      if (!current) {
        logger.warn('Profile update failed: user not found', { userId })
        throw new AppError('User not found', 404, true, ErrorCode.NOT_FOUND)
      }

      const emailChanged = parsed.email !== undefined && parsed.email !== current.email
      const verification = emailChanged ? generateVerificationToken(userId) : null

      const updated = await repo.update(userId, {
        ...parsed,
        ...(emailChanged
          ? {
              verified: false,
              verificationToken: verification!.hash,
              verificationTokenExpiry: verification!.expiry,
            }
          : {}),
      })

      if (emailChanged) {
        logger.info('Email changed, verification email sent', { userId, newEmail: updated.email })
        await mailer.sendVerificationEmail(updated.email, updated.firstName, verification!.raw)
      } else {
        logger.info('User profile updated successfully', { userId })
      }

      return sanitizeUser(updated)
    },

    async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
      if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400, true, ErrorCode.VALIDATION_ERROR)

      const user = await repo.findById(userId)
      if (!user || !user.password) throw new AppError('No password set on this account', 400, true, ErrorCode.VALIDATION_ERROR)

      const valid = await argon2.verify(user.password, currentPassword)
      if (!valid) throw new AppError('Current password is incorrect', 400, true, ErrorCode.VALIDATION_ERROR)

      const hashed = await argon2.hash(newPassword)
      await repo.update(userId, { password: hashed })
      logger.info('Password changed', { userId })
    },

    async deleteAccount(userId: string): Promise<void> {
      await repo.delete(userId)
      logger.info('Account deleted', { userId })
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────
//
// Controllers import these functions directly — these re-exports delegate to a
// default instance wired with production dependencies.

const _defaultService = createUserService({
  userRepository: defaultUserRepository,
  mailer: { sendVerificationEmail, sendPasswordResetEmail: async () => undefined },
})

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  return _defaultService.updateProfile(userId, input)
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  return _defaultService.changePassword(userId, currentPassword, newPassword)
}

export async function deleteAccount(userId: string): Promise<void> {
  return _defaultService.deleteAccount(userId)
}

export interface PushSubscriptionInput {
  endpoint: string
  keys: { auth: string; p256dh: string }
}

export async function savePushSubscription(userId: string, input: PushSubscriptionInput) {
  const { endpoint, keys } = input
  return db.pushSubscription.upsert({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    where: { userId_endpoint: { userId, endpoint } } as any,
    update: { auth: keys.auth, p256dh: keys.p256dh },
    create: { userId, endpoint, auth: keys.auth, p256dh: keys.p256dh },
  })
}

export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.pushSubscription.delete({ where: { userId_endpoint: { userId, endpoint } } as any })
}

export async function completeOnboarding(userId: string) {
  const user = await defaultUserRepository.update(userId, { onboardingCompleted: true })
  return sanitizeUser(user)
}
