import { db as defaultDb } from '../db.js'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { AppError } from '../utils/AppError.js'
import { sanitizeUser } from '../models/user.model.js'
import { createServiceLogger } from '../utils/logger.js'
import type { LoginBody } from '../interfaces/index.js'
import type { AuthServiceDeps } from '../container/types.js'

const logger = createServiceLogger('AuthService')
const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL_DAYS = 7

/**
 * Generate a refresh token: raw random bytes + its SHA-256 hash + expiry.
 */
export function generateRefreshToken() {
  const raw = crypto.randomBytes(40).toString('hex')
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  return { raw, hash, expiresAt }
}

export function createAuthSessionService(deps: Pick<AuthServiceDeps, 'userRepository' | 'db'>) {
  const { userRepository, db } = deps

  return {
    /**
     * Authenticate a user with email and password.
     */
    async loginUser(
      { email, password }: LoginBody,
      deviceName?: string,
      userAgent?: string,
      ipAddress?: string,
    ) {
      logger.debug('Login attempt', { email })
      const user = await userRepository.findByEmail(email)
      if (!user || !user.password || !(await argon2.verify(user.password, password))) {
        logger.warn('Login failed: invalid credentials', { email })
        throw new AppError('Invalid credentials', 401)
      }
      if (!user.verified) {
        logger.warn('Login failed: email not verified', { email })
        throw new AppError(
          'Your email address has not been verified. Please check your inbox and click the verification link.',
          403,
        )
      }

      const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
        expiresIn: ACCESS_TOKEN_TTL,
      })

      const { raw: refreshTokenRaw, hash: refreshTokenHash, expiresAt } = generateRefreshToken()
      await db.refreshToken.create({ data: { userId: user.id, tokenHash: refreshTokenHash, expiresAt } })

      let deviceId: string | undefined
      if (deviceName && ipAddress) {
        const device = await db.device.create({
          data: { userId: user.id, deviceName, userAgent, ipAddress },
        })
        deviceId = (device as { id: string }).id
      }

      logger.info('User logged in successfully', { userId: user.id, email })
      return { data: sanitizeUser(user), token: accessToken, refreshToken: refreshTokenRaw, deviceId }
    },

    /**
     * Exchange a valid refresh token for a new access token + refresh token pair.
     */
    async rotateRefreshToken(rawToken: string) {
      const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const stored = await db.refreshToken.findUnique({ where: { tokenHash: hash } }) as {
        id: string; revokedAt: Date | null; expiresAt: Date; userId: string
      } | null

      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new AppError('Invalid or expired refresh token', 401)
      }

      await db.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } })

      const user = await userRepository.findById(stored.userId)
      if (!user) throw new AppError('User not found', 404)

      const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
        expiresIn: ACCESS_TOKEN_TTL,
      })

      const { raw: newRefreshRaw, hash: newRefreshHash, expiresAt } = generateRefreshToken()
      await db.refreshToken.create({ data: { userId: user.id, tokenHash: newRefreshHash, expiresAt } })

      return { token: accessToken, refreshToken: newRefreshRaw }
    },

    /**
     * Revoke all refresh tokens for a user (called on logout).
     */
    async revokeAllRefreshTokens(userId: string) {
      await db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    },
  }
}
