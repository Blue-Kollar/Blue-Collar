/**
 * Cache Service — Issue #773
 *
 * A Redis-backed cache service abstraction that provides:
 * - Typed get/set/del operations
 * - Pattern-based invalidation
 * - Event-driven invalidation helpers
 * - Hit/miss metrics exposed via Prometheus
 * - Graceful degradation when Redis is unavailable
 */

import { redis } from '../config/redis.js'
import { logger } from '../config/logger.js'
import { Counter, Histogram, register } from 'prom-client'

// ── Prometheus metrics ────────────────────────────────────────────────────────

const cacheHitsTotal = new Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['key_prefix'] as const,
})

const cacheMissesTotal = new Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['key_prefix'] as const,
})

const cacheOperationDuration = new Histogram({
  name: 'cache_operation_duration_seconds',
  help: 'Duration of cache operations in seconds',
  labelNames: ['operation'] as const,
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5],
})

// Register metrics (idempotent — safe to call multiple times in tests)
try {
  register.registerMetric(cacheHitsTotal)
  register.registerMetric(cacheMissesTotal)
  register.registerMetric(cacheOperationDuration)
} catch {
  // Already registered — ignore
}

// ── TTL presets ───────────────────────────────────────────────────────────────

export const CacheTTL = {
  /** 60 s — frequently changing data (availability, reviews) */
  SHORT: 60,
  /** 300 s — worker profiles */
  MEDIUM: 300,
  /** 600 s — semi-static lists (worker search results) */
  LONG: 600,
  /** 3 600 s — categories, aggregates (rarely change) */
  HOUR: 3_600,
  /** 86 400 s — very stable data */
  DAY: 86_400,
} as const

// ── Key helpers ───────────────────────────────────────────────────────────────

/** Standard key prefixes to namespace cache entries. */
export const CacheKeys = {
  workerList: (params: string) => `cache:workers:list:${params}`,
  workerProfile: (id: string) => `cache:workers:profile:${id}`,
  workerSearch: (query: string) => `cache:workers:search:${query}`,
  categoryList: () => `cache:categories:list`,
  categoryById: (id: string) => `cache:categories:${id}`,
  ratingAggregate: (workerId: string) => `cache:ratings:${workerId}`,
  availability: (workerId: string) => `cache:availability:${workerId}`,
} as const

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Get a cached value by key.
 * Returns `null` on miss or Redis error.
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  const end = cacheOperationDuration.startTimer({ operation: 'get' })
  const prefix = key.split(':')[1] ?? 'unknown'
  try {
    const raw = await redis.get(key)
    end()
    if (raw === null) {
      cacheMissesTotal.inc({ key_prefix: prefix })
      return null
    }
    cacheHitsTotal.inc({ key_prefix: prefix })
    return JSON.parse(raw) as T
  } catch (err) {
    end()
    logger.warn({ err, key }, 'Cache GET error — cache miss')
    return null
  }
}

/**
 * Set a value in cache with TTL (seconds).
 * Silently ignores Redis errors.
 */
export async function cacheSet<T>(key: string, value: T, ttlSec: number): Promise<void> {
  const end = cacheOperationDuration.startTimer({ operation: 'set' })
  try {
    await redis.setex(key, ttlSec, JSON.stringify(value))
  } catch (err) {
    logger.warn({ err, key }, 'Cache SET error — skipping cache write')
  } finally {
    end()
  }
}

/**
 * Delete one or more exact cache keys.
 */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return
  const end = cacheOperationDuration.startTimer({ operation: 'del' })
  try {
    await redis.del(...keys)
  } catch (err) {
    logger.warn({ err, keys }, 'Cache DEL error')
  } finally {
    end()
  }
}

/**
 * Delete all keys matching a glob pattern (uses SCAN for safety).
 *
 * @example
 * await cacheInvalidatePattern('cache:workers:*')
 */
export async function cacheInvalidatePattern(pattern: string): Promise<number> {
  const end = cacheOperationDuration.startTimer({ operation: 'invalidate_pattern' })
  let deleted = 0
  try {
    let cursor = '0'
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      if (keys.length > 0) {
        await redis.del(...keys)
        deleted += keys.length
      }
    } while (cursor !== '0')
    logger.debug({ pattern, deleted }, 'Cache invalidated by pattern')
  } catch (err) {
    logger.warn({ err, pattern }, 'Cache pattern invalidation error')
  } finally {
    end()
  }
  return deleted
}

/**
 * Cache-aside helper: return cached value or call `fetchFn`, cache its result.
 *
 * @example
 * const workers = await cacheOrFetch(
 *   CacheKeys.workerList('page=1'),
 *   () => workerService.list({ page: 1 }),
 *   CacheTTL.LONG,
 * )
 */
export async function cacheOrFetch<T>(
  key: string,
  fetchFn: () => Promise<T>,
  ttlSec: number,
): Promise<T> {
  const cached = await cacheGet<T>(key)
  if (cached !== null) return cached
  const fresh = await fetchFn()
  await cacheSet(key, fresh, ttlSec)
  return fresh
}

// ── Event-driven invalidation helpers ────────────────────────────────────────

/**
 * Invalidate all caches related to a specific worker.
 * Call after any write that modifies worker data.
 */
export async function invalidateWorkerCache(workerId: string): Promise<void> {
  await Promise.all([
    cacheDel(CacheKeys.workerProfile(workerId)),
    cacheDel(CacheKeys.ratingAggregate(workerId)),
    cacheDel(CacheKeys.availability(workerId)),
    cacheInvalidatePattern('cache:workers:list:*'),
    cacheInvalidatePattern('cache:workers:search:*'),
  ])
  logger.debug({ workerId }, 'Worker cache invalidated')
}

/**
 * Invalidate all caches related to categories.
 */
export async function invalidateCategoryCache(categoryId?: string): Promise<void> {
  const ops: Promise<unknown>[] = [cacheDel(CacheKeys.categoryList())]
  if (categoryId) ops.push(cacheDel(CacheKeys.categoryById(categoryId)))
  await Promise.all(ops)
  logger.debug({ categoryId }, 'Category cache invalidated')
}

/**
 * Invalidate rating aggregate cache after a review is written.
 */
export async function invalidateRatingCache(workerId: string): Promise<void> {
  await cacheDel(CacheKeys.ratingAggregate(workerId))
}

// ── Metrics accessor ──────────────────────────────────────────────────────────

/** Return current hit/miss counters for health endpoints. */
export function getCacheMetricsSummary() {
  return {
    hits: (cacheHitsTotal as unknown as { hashMap: Record<string, { value: number }> })
      .hashMap,
    misses: (cacheMissesTotal as unknown as { hashMap: Record<string, { value: number }> })
      .hashMap,
  }
}
