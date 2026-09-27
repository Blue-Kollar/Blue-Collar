import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { AppError } from '../utils/AppError.js'
import { sanitizeUser } from '../models/user.model.js'
import { createServiceLogger } from '../utils/logger.js'
import type { RegisterBody } from '../interfaces/index.js'
import type { AuthServiceDeps } from '../container/types.js'

const logger = createServiceLogger('AuthService')

/**
 * Generate a short-lived email verification token for a user.
 */
export function generateVerificationToken(userId: string) {
  const raw = jwt.sign({ id: userId, purpose: 'email-verify' }, process.env.JWT_SECRET!, {
    expiresIn: '24h',
  })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return { raw, hash, expiry }
}

export function createAuthRecoveryService(deps: Pick<AuthServiceDeps, 'userRepository' | 'mailer' | 'db'>) {
  const { userRepository, mailer, db } = deps

  return {
    /**
     * Register a new user account and send a verification email.
     */
    async registerUser({ email, password, firstName, lastName }: RegisterBody) {
      logger.debug('Registration attempt', { email })
      const existing = await userRepository.findByEmail(email)
      if (existing) {
        logger.warn('Registration failed: email already in use', { email })
        throw new AppError('Email already in use', 409)
      }

      const hashed = await argon2.hash(password)
      const user = await userRepository.create({ email, password: hashed, firstName, lastName })

      const { raw, hash, expiry } = generateVerificationToken(user.id)
      await userRepository.update(user.id, { verificationToken: hash, verificationTokenExpiry: expiry })

      mailer.sendVerificationEmail(email, firstName, raw).catch((err: unknown) =>
        logger.error('Failed to send verification email', err),
      )

      logger.info('User registered successfully', { userId: user.id, email })
      return sanitizeUser(user)
    },

    /**
     * Verify a user's email address using the raw JWT from the verification email.
     */
    async verifyAccount(token: string): Promise<boolean> {
      logger.debug('Email verification attempt')
      let payload: { id?: string; purpose?: string }
      try {
        payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; purpose: string }
      } catch {
        logger.warn('Email verification failed: invalid token')
        throw new AppError('Token is invalid or has expired', 400)
      }

      if (payload.purpose !== 'email-verify' || !payload.id) {
        throw new AppError('Invalid verification token', 400)
      }

      const user = await userRepository.findById(payload.id)
      if (!user) throw new AppError('User not found', 404)
      if (user.verified) return false

      const incomingHash = crypto.createHash('sha256').update(token).digest('hex')
      const valid =
        incomingHash === user.verificationToken &&
        user.verificationTokenExpiry &&
        user.verificationTokenExpiry > new Date()

      if (!valid) throw new AppError('Token is invalid or has expired', 400)

      await userRepository.update(user.id, { verified: true, verificationToken: null, verificationTokenExpiry: null })
      logger.info('Email verified successfully', { userId: user.id })
      return true
    },

    /**
     * Resend a verification email to an unverified account.
     */
    async resendVerificationEmail(email: string) {
      const user = await userRepository.findByEmail(email)
      if (!user || user.verified) return

      const { raw, hash, expiry } = generateVerificationToken(user.id)
      await userRepository.update(user.id, { verificationToken: hash, verificationTokenExpiry: expiry })

      mailer.sendVerificationEmail(email, user.firstName, raw).catch((err: unknown) =>
        logger.error('Failed to resend verification email', err),
      )
    },

    /**
     * Initiate a password reset flow.
     */
    async requestPasswordReset(email: string) {
      const user = await userRepository.findByEmail(email)
      if (!user) return

      const rawToken = crypto.randomBytes(32).toString('hex')
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiry = new Date(Date.now() + 60 * 60 * 1000)

      await userRepository.update(user.id, { resetToken: hash, resetTokenExpiry: expiry })

      mailer.sendPasswordResetEmail(user.email, user.firstName, rawToken).catch((err: unknown) =>
        logger.error('Failed to send password reset email', err),
      )
    },

    /**
     * Reset a user's password using the raw token from the reset email.
     */
    async resetPassword(token: string, password: string) {
      const hash = crypto.createHash('sha256').update(token).digest('hex')
      const user = await userRepository.findByResetToken(hash)
      if (!user) throw new AppError('Token is invalid or has expired', 400)

      const hashedPassword = await argon2.hash(password)

      await db.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      await db.device.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      })

      await userRepository.update(user.id, { password: hashedPassword, resetToken: null, resetTokenExpiry: null })
      logger.info('Password reset successfully - all sessions revoked', { userId: user.id })
    },
  }
}
