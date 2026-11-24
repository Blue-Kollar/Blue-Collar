/**
 * Shared cache / queue helpers — single source of truth (issue #1805).
 *
 * These utilities were previously duplicated across the mobile and app data
 * layers. They live in the SDK so every consumer derives identical cache keys
 * and applies identical expiry semantics.
 */

/** Default cache time-to-live in milliseconds (5 minutes). */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** A cached value together with the metadata needed to expire it. */
export interface CacheEntry<T = unknown> {
  data: T;
  /** Timestamp (ms) at which the value was cached. */
  timestamp: number;
  /** Time-to-live in milliseconds. */
  ttl: number;
  /** Optional freshness window in milliseconds. */
  staleTime?: number;
}

/** Options controlling how long a cached value remains valid. */
export interface CacheOptions {
  ttl?: number;
  staleTime?: number;
}

/** A unit of work waiting to be processed by an offline queue. */
export interface QueueJob<T = unknown> {
  id: string;
  type: string;
  payload: T;
  createdAt: number;
  retries: number;
  maxRetries: number;
  status?: 'pending' | 'processing' | 'failed';
  lastError?: string;
}

/** Options controlling an offline queue. */
export interface QueueOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  maxQueueSize?: number;
}

/**
 * Build a stable, colon-delimited cache key from its parts. Empty parts are
 * dropped so optional segments do not produce ambiguous separators.
 */
export function createCacheKey(...parts: readonly (string | number | null | undefined)[]): string {
  return parts.filter((part) => part !== '' && part !== undefined && part !== null).join(':');
}

/**
 * Determine whether a cache entry has reached its time-to-live.
 *
 * @param entry - Entry (or just its `timestamp`/`ttl` metadata) to inspect.
 * @param now   - Current timestamp (ms); defaults to `Date.now()`.
 */
export function isCacheEntryExpired(
  entry: Pick<CacheEntry, 'timestamp' | 'ttl'>,
  now: number = Date.now(),
): boolean {
  return now - entry.timestamp >= entry.ttl;
}
