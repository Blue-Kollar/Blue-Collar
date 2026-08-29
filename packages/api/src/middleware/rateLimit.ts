/**
 * Sophisticated Rate Limiting middleware — Issue #774
 *
 * Redis-backed sliding-window rate limiter with:
 * - Per-user (auth) and per-IP (anon) buckets
 * - Per-endpoint configuration via rateLimits.ts
 * - Burst allowance (token-bucket style)
 * - RateLimit-* headers (IETF draft-6585)
 * - Admin role and IP allowlist bypass
 * - Exponential backoff hint in Retry-After
 * - Graceful degradation when Redis is unavailable
 */

import type { Request, Response, NextFunction } from 'express'
import { redis } from '../config/redis.js'
import { logger } from '../config/logger.js'
import { RATE_LIMIT_ALLOWLIST, type RateLimitConfig } from '../config/rateLimits.js'

// ── Sliding window implementation ─────────────────────────────────────────────

/**
 * Sliding-window rate limiter using Redis sorted sets.
 *
 * Each request is added to a sorted set keyed by identifier.
 * Expired entries (outside the window) are removed on each check.
 *
 * @returns { count, allowed, remaining, resetAt }
 */
async function slidingWindowCheck(
  identifier: string,
  windowSec: number,
  limit: number,
  burstAllowance: number,
): Promise<{ count: number; allowed: boolean; remaining: number; resetAt: number }> {
  const now = Date.now()
  const windowMs = windowSec * 1000
  const effectiveLimit = limit + burstAllowance
  const key = `rl:sw:${identifier}`

  const pipeline = redis.pipeline()
  // Remove expired entries
  pipeline.zremrangebyscore(key, '-inf', now - windowMs)
  // Add this request with score = timestamp
  pipeline.zadd(key, now, `${now}-${Math.random()}`)
  // Count current requests in window
  pipeline.zcard(key)
  // Set TTL
  pipeline.expire(key, windowSec + 1)

  const results = await pipeline.exec()
  const count = (results?.[2]?.[1] as number) ?? 1
  const allowed = count <= effectiveLimit
  const remaining = Math.max(0, effectiveLimit - count)
  const resetAt = Math.floor((now + windowMs) / 1000)

  return { count, allowed, remaining, resetAt }
}

// ── Violation tracking ────────────────────────────────────────────────────────

async function getViolationCount(identifier: string, windowSec: number): Promise<number> {
  const key = `rl:violations:${identifier}`
  const violations = await redis.incr(key)
  await redis.expire(key, windowSec * 10)
  return violations
}

// ── Main factory ──────────────────────────────────────────────────────────────

/**
 * Create a rate limiting middleware from a `RateLimitConfig`.
 *
 * @example
 * import { createRateLimiter } from '../middleware/rateLimit.js'
 * import { AUTH_STRICT } from '../config/rateLimits.js'
 *
 * router.post('/login', createRateLimiter(AUTH_STRICT), authController.login)
 */
export function createRateLimiter(config: RateLimitConfig) {
  const { windowSec, anonLimit, authLimit, adminLimit, burstAllowance } = config

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const ip = (req.ip ?? req.socket.remoteAddress ?? 'unknown').replace('::ffff:', '')

    // IP allowlist bypass
    if (RATE_LIMIT_ALLOWLIST.has(ip)) return next()

    // Admin bypass (adminLimit === 0 means unlimited)
    if (req.user?.role === 'admin' && adminLimit === 0) return next()

    const isAuth = !!req.user
    const limit = isAuth
      ? (req.user?.role === 'admin' && adminLimit > 0 ? adminLimit : authLimit)
      : anonLimit

    // Unauthenticated users with limit=0 are not allowed
    if (!isAuth && limit === 0) {
      res.status(401).json({
        status: 'error',
        message: 'Authentication required for this endpoint.',
        code: 401,
      })
      return
    }

    const identifier = isAuth ? `user:${req.user!.id}` : `ip:${ip}`

    try {
      const { allowed, remaining, resetAt, count } = await slidingWindowCheck(
        `${identifier}:${req.route?.path ?? req.path}`,
        windowSec,
        limit,
        burstAllowance,
      )

      // Set standard RateLimit headers on every response
      res.setHeader('RateLimit-Limit', limit + burstAllowance)
      res.setHeader('RateLimit-Remaining', remaining)
      res.setHeader('RateLimit-Reset', resetAt)
      res.setHeader('RateLimit-Policy', `${limit};w=${windowSec}`)

      if (!allowed) {
        const violations = await getViolationCount(identifier, windowSec).catch(() => 1)
        // Exponential backoff: 1× → 2× → 4× … up to 1 hour
        const backoff = Math.min(windowSec * Math.pow(2, violations - 1), 3_600)

        res.setHeader('Retry-After', backoff)
        res.setHeader('RateLimit-Remaining', 0)

        logger.warn({ identifier, count, limit, violations }, 'Rate limit exceeded')

        res.status(429).json({
          status: 'error',
          message: 'Too many requests. Please slow down.',
          code: 429,
          retryAfter: backoff,
        })
        return
      }
    } catch (err) {
      // Redis unavailable — fail open
      logger.warn({ err }, 'Rate limiter Redis error — failing open')
    }

    next()
  }
}

// ── Pre-built limiters for common use cases ───────────────────────────────────

import {
  AUTH_STRICT,
  AUTH_MODERATE,
  WORKERS_READ,
  WORKERS_WRITE,
  CONTACT,
  GENERAL_API,
  BOOKINGS,
} from '../config/rateLimits.js'

/** Strict auth limiter — login, register, forgot-password */
export const strictAuthRateLimiter = createRateLimiter(AUTH_STRICT)

/** Moderate auth limiter — email verification, resend */
export const moderateAuthRateLimiter = createRateLimiter(AUTH_MODERATE)

/** Worker read limiter — public listing and search */
export const workersReadRateLimiter = createRateLimiter(WORKERS_READ)

/** Worker write limiter — create/update/delete */
export const workersWriteRateLimiter = createRateLimiter(WORKERS_WRITE)

/** Contact request limiter */
export const contactRateLimit = createRateLimiter(CONTACT)

/** General API limiter */
export const generalRateLimit = createRateLimiter(GENERAL_API)

/** Booking request limiter */
export const bookingRateLimit = createRateLimiter(BOOKINGS)
