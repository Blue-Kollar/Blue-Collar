/**
 * Cache key builders and TTL presets — Issue #1636
 *
 * Centralises every cache key and TTL used by the API so callers no longer
 * build keys inline. This prevents collisions between features and keeps
 * invalidation patterns in sync with the keys that are written.
 */

/** Time-to-live presets, in seconds. */
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
  /** 1 800 s — personalised recommendations */
  RECOMMENDATIONS: 1_800,
} as const

/** Standard key builders namespace every cache entry. */
export const CacheKeys = {
  workerList: (params: string) => `cache:workers:list:${params}`,
  workerProfile: (id: string) => `cache:workers:profile:${id}`,
  workerSearch: (query: string) => `cache:workers:search:${query}`,
  categoryList: () => `cache:categories:list`,
  categoryById: (id: string) => `cache:categories:item:${id}`,
  ratingAggregate: (workerId: string) => `cache:ratings:${workerId}`,
  availability: (workerId: string) => `cache:availability:${workerId}`,
  recommendations: (userId: string) => `recommendations:${userId}`,
} as const
