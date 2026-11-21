/** Re-export shared types from @bluecollar/types */
export type {
  AccountInfo,
  BroadcastResult,
  TxStatus,
  SdkConfig,
  WorkerRegistration,
  ReputationSync
} from '@bluecollar/types'

// Re-export shared cache/retry helpers and types (issue #1805)
export {
  DEFAULT_CACHE_TTL_MS,
  DEFAULT_STALE_TIME_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_CACHE_CONFIG,
  DEFAULT_RETRY_CONFIG,
  resolveCacheConfig,
  isCacheStale,
  isCacheExpired,
  resolveRetryConfig,
  getRetryDelay,
  shouldRetry,
  executeWithRetry
} from './types'

export type { CacheConfig, RetryConfig } from './types'

// SDK-specific types not shared elsewhere
export interface UnsignedTxParams {
  sourcePublicKey: string;
  destinationPublicKey: string;
  amount: string;
  memo: string;
  sequence: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared API response shapes — issue #1237
//
// Previously ApiResponse and PaginatedResult were independently defined in:
//   packages/api/src/interfaces/response.interface.ts
//   packages/app/src/types/index.ts
// with subtly different field names (PaginatedResult vs PaginatedResponse,
// meta.pages vs meta.totalPages).  Both packages now import from here so
// there is a single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pagination metadata included in list responses.
 * Canonical shape: matches the `meta` object produced by all paginated
 * API handlers in packages/api.
 */
export interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

/**
 * Standard API response envelope returned by every endpoint.
 *
 * - `status`  — `'success'` | `'error'`
 * - `code`    — mirrors the HTTP status code
 * - `message` — human-readable summary (optional on success)
 * - `data`    — typed payload (absent on error responses)
 * - `token`   — JWT token (auth endpoints only)
 * - `meta`    — pagination metadata (list endpoints only)
 */
export interface ApiResponse<T = undefined> {
  status: 'success' | 'error'
  message?: string
  code: number
  data?: T
  token?: string
  meta?: Meta
}

/**
 * Paginated list response — convenience alias for endpoints that always
 * return a page of items with full pagination metadata.
 */
export type PaginatedResult<T> = ApiResponse<T[]> & { meta: Meta }

/**
 * Alias kept for backwards-compatibility with packages/app which previously
 * used `PaginatedResponse`.  New code should use `PaginatedResult`.
 * @deprecated Use `PaginatedResult` instead.
 */
export type PaginatedResponse<T> = PaginatedResult<T>

// ─────────────────────────────────────────────────────────────────────────────
// Shared mobile/app logic — issue #1805
//
// The following cache and queued-action helpers were previously duplicated in
// packages/mobile (and partially in packages/app).  They now live here so both
// packages consume a single implementation.
// ─────────────────────────────────────────────────────────────────────────────

/** Default cache time-to-live in milliseconds (5 minutes). */
export const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

/** Default stale time in milliseconds (30 seconds). */
export const DEFAULT_STALE_TIME_MS = 30 * 1000

/** Default maximum number of retry attempts for queued actions. */
export const DEFAULT_MAX_RETRIES = 3

/** Default base delay (ms) between queued-action retries. */
export const DEFAULT_RETRY_DELAY_MS = 1000

/** Cache timing configuration shared by mobile and app data layers. */
export interface CacheConfig {
  /** How long cached data remains valid, in milliseconds. */
  ttlMs: number
  /** How long cached data is considered fresh, in milliseconds. */
  staleTimeMs: number
}

/** Default cache configuration used when none is supplied. */
export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  ttlMs: DEFAULT_CACHE_TTL_MS,
  staleTimeMs: DEFAULT_STALE_TIME_MS
}

/**
 * Merge a partial cache configuration with the shared defaults.
 */
export function resolveCacheConfig(config?: Partial<CacheConfig>): CacheConfig {
  return {
    ttlMs: config?.ttlMs ?? DEFAULT_CACHE_TTL_MS,
    staleTimeMs: config?.staleTimeMs ?? DEFAULT_STALE_TIME_MS
  }
}

/**
 * Determine whether cached data has gone stale.
 *
 * @param cachedAt  Timestamp (ms) when the data was cached.
 * @param now       Current timestamp (ms); defaults to `Date.now()`.
 * @param config    Optional cache configuration overrides.
 */
export function isCacheStale(
  cachedAt: number,
  now: number = Date.now(),
  config?: Partial<CacheConfig>
): boolean {
  const { staleTimeMs } = resolveCacheConfig(config)
  return now - cachedAt >= staleTimeMs
}

/**
 * Determine whether cached data has fully expired and must be discarded.
 *
 * @param cachedAt  Timestamp (ms) when the data was cached.
 * @param now       Current timestamp (ms); defaults to `Date.now()`.
 * @param config    Optional cache configuration overrides.
 */
export function isCacheExpired(
  cachedAt: number,
  now: number = Date.now(),
  config?: Partial<CacheConfig>
): boolean {
  const { ttlMs } = resolveCacheConfig(config)
  return now - cachedAt >= ttlMs
}

/** Configuration controlling queued-action retry behaviour. */
export interface RetryConfig {
  /** Maximum number of retry attempts. */
  maxRetries: number
  /** Base delay between retries, in milliseconds. */
  retryDelayMs: number
}

/** Default retry configuration used when none is supplied. */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: DEFAULT_MAX_RETRIES,
  retryDelayMs: DEFAULT_RETRY_DELAY_MS
}

/**
 * Merge a partial retry configuration with the shared defaults.
 */
export function resolveRetryConfig(config?: Partial<RetryConfig>): RetryConfig {
  return {
    maxRetries: config?.maxRetries ?? DEFAULT_MAX_RETRIES,
    retryDelayMs: config?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  }
}

/**
 * Compute the exponential backoff delay for a given retry attempt.
 *
 * @param attempt   Zero-based retry attempt index.
 * @param config    Optional retry configuration overrides.
 */
export function getRetryDelay(
  attempt: number,
  config?: Partial<RetryConfig>
): number {
  const { retryDelayMs } = resolveRetryConfig(config)
  const safeAttempt = Math.max(0, Math.floor(attempt))
  return retryDelayMs * Math.pow(2, safeAttempt)
}

/**
 * Determine whether another retry should be attempted.
 *
 * @param attempt   Number of attempts already made.
 * @param config    Optional retry configuration overrides.
 */
export function shouldRetry(
  attempt: number,
  config?: Partial<RetryConfig>
): boolean {
  const { maxRetries } = resolveRetryConfig(config)
  return attempt < maxRetries
}

/**
 * Execute an async action with retry/backoff semantics shared by the mobile
 * queued-action processor and the app's offline queue.
 *
 * @param action    Async function to execute.
 * @param config    Optional retry configuration overrides.
 * @param sleep     Injectable delay function (defaults to a setTimeout-based
 *                  sleep) to keep the helper testable.
 */
export async function executeWithRetry<T>(
  action: () => Promise<T>,
  config?: Partial<RetryConfig>,
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<T> {
  const resolved = resolveRetryConfig(config)
  let attempt = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await action()
    } catch (error) {
      if (!shouldRetry(attempt, resolved)) {
        throw error
      }
      await sleep(getRetryDelay(attempt, resolved))
      attempt += 1
    }
  }
}
