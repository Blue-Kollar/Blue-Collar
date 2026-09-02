import type { NextFunction,Request, Response } from 'express'

import { redis } from '../config/redis.js'

interface UserRateLimitOptions {
  /** Window size in seconds */
  windowSec: number
  /** Max requests for anonymous users */
  anonLimit: number
  /** Max requests for authenticated users */
  authLimit: number
}

/**
 * Redis-based per-user rate limiter.
 *
 * - Anonymous users are keyed by IP.
 * - Authenticated users are keyed by user ID (higher limits).
 * - Admin role bypasses all limits.
 * - Adds RateLimit-* headers and Retry-After on 429.
 * - Implements exponential backoff hint via Retry-After.
 */
export function userRateLimit(options: UserRateLimitOptions) {
  const { windowSec, anonLimit, authLimit } = options

  return async (req: Request, res: Response, next: NextFunction) => {
    // Admin bypass
    if (req.user?.role === 'admin') return next()

    const isAuth = !!req.user
    const limit = isAuth ? authLimit : anonLimit
    const identifier = isAuth ? `user:${req.user!.id}` : `ip:${req.ip}`
    const key = `rl:${identifier}:${req.path}`

    try {
      const pipeline = redis.pipeline()
      pipeline.incr(key)
      pipeline.ttl(key)
      const results = await pipeline.exec()

      const count = (results?.[0]?.[1] as number) ?? 1
      const ttl = (results?.[1]?.[1] as number) ?? -1

      // Set expiry on first request
      if (count === 1) {
        await redis.expire(key, windowSec)
      }

      const remaining = Math.max(0, limit - count)
      const resetAt = ttl > 0 ? Math.floor(Date.now() / 1000) + ttl : Math.floor(Date.now() / 1000) + windowSec

      res.setHeader('RateLimit-Limit', limit)
      res.setHeader('RateLimit-Remaining', remaining)
      res.setHeader('RateLimit-Reset', resetAt)

      if (count > limit) {
        // Exponential backoff: double the window for repeat violators
        const violations = await redis.incr(`rl:violations:${identifier}`)
        await redis.expire(`rl:violations:${identifier}`, windowSec * 10)
        const backoff = Math.min(windowSec * Math.pow(2, violations - 1), 3600)

        res.setHeader('Retry-After', backoff)
        return res.status(429).json({
          status: 'error',
          message: 'Too many requests. Please slow down.',
          code: 429,
          retryAfter: backoff,
        })
      }
    } catch {
      // Redis unavailable — fail open (don't block requests)
    }

    next()
  }
}

/**
 * Contact request rate limiter: 5 per hour for auth users, 1 per hour for anon.
 */
export const contactRateLimit = userRateLimit({
  windowSec: 3600,
  anonLimit: 1,
  authLimit: 5,
})

/**
 * General API rate limiter: 200/15min auth, 60/15min anon.
 */
export const generalRateLimit = userRateLimit({
  windowSec: 900,
  anonLimit: 60,
  authLimit: 200,
})
