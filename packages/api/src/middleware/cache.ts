/**
 * Cache middleware — Issue #773
 *
 * Express middleware that serves GET responses from Redis and stores
 * fresh responses back into the cache.  Delegates to the cache service
 * for all Redis I/O so metrics and error handling are consistent.
 */

import type { Request, Response, NextFunction } from 'express'
import {
  cacheGet,
  cacheSet,
  cacheInvalidatePattern,
  cacheDel,
  CacheTTL,
  CacheKeys,
} from '../services/cache.service.js'

export { CacheTTL, CacheKeys }

/**
 * Cache middleware for GET endpoints.
 *
 * - Skips non-GET requests.
 * - Serves from cache on HIT (adds `X-Cache: HIT` header).
 * - Intercepts `res.json` on MISS to store the response (adds `X-Cache: MISS`).
 * - Gracefully skips caching when Redis is unavailable.
 *
 * @param ttl     - Time-to-live in seconds (use `CacheTTL.*` presets).
 * @param keyFn   - Optional function to derive a custom key from the request.
 *                  Defaults to `cache:<originalUrl>`.
 *
 * @example
 * router.get('/workers', cacheMiddleware(CacheTTL.LONG), workersController.list)
 */
export function cacheMiddleware(
  ttl: number,
  keyFn?: (req: Request) => string,
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.method !== 'GET') return next()

    const key = keyFn ? keyFn(req) : `cache:${req.originalUrl}`

    const cached = await cacheGet(key)
    if (cached !== null) {
      res.setHeader('X-Cache', 'HIT')
      res.json(cached)
      return
    }

    res.setHeader('X-Cache', 'MISS')

    // Intercept res.json to persist the response
    const originalJson = res.json.bind(res)
    res.json = (body: unknown) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cacheSet(key, body, ttl).catch(() => {})
      }
      return originalJson(body)
    }

    next()
  }
}

/**
 * Invalidate one or more exact cache keys.
 * Use after writes to keep the cache consistent.
 */
export { cacheDel as invalidateCache }

/**
 * Invalidate all cache keys matching a glob pattern.
 *
 * @example
 * await invalidateCachePattern('cache:/api/workers*')
 */
export { cacheInvalidatePattern as invalidateCachePattern }
