// Closes #1855

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../config/redis.js', () => {
  const mockRedis = {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    scan: vi.fn(),
  };
  return { redis: mockRedis, cacheMetrics: { hits: 0, misses: 0 } };
});

vi.mock('prom-client', () => {
  const makeCounter = () => ({
    inc: vi.fn(),
  });
  const makeHistogram = () => ({
    startTimer: vi.fn(() => vi.fn()),
    observe: vi.fn(),
  });
  const register = {
    registerMetric: vi.fn(),
    clear: vi.fn(),
  };
  return {
    Counter: vi.fn(() => makeCounter()),
    Histogram: vi.fn(() => makeHistogram()),
    register,
  };
});

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/date.js', () => ({
  nowUtc: vi.fn(() => new Date()),
  parseUtcDate: vi.fn((s: string) => new Date(s)),
  addUtcMs: vi.fn((d: Date, ms: number) => new Date(d.getTime() + ms)),
  formatUtcIso: vi.fn((d: Date) => d.toISOString()),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { redis } from '../../config/redis.js';
import {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheOrFetch,
  cacheInvalidatePattern,
  invalidateWorkerCache,
  invalidateCategoryCache,
  invalidateRatingCache,
  CacheKeys,
} from '../../services/cache.service.js';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('cache.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── cacheGet ───────────────────────────────────────────────────────────────

  describe('cacheGet', () => {
    it('returns null on Redis miss', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null);

      const result = await cacheGet('cache:workers:profile:w1');

      expect(result).toBeNull();
    });

    it('returns parsed JSON on cache hit', async () => {
      const payload = { id: 'w1', name: 'Alice' };
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(payload));

      const result = await cacheGet<{ id: string; name: string }>('cache:workers:profile:w1');

      expect(result).toEqual(payload);
    });

    it('returns null on Redis error (graceful degradation)', async () => {
      vi.mocked(redis.get).mockRejectedValueOnce(new Error('connection refused'));

      const result = await cacheGet('cache:workers:profile:w1');

      expect(result).toBeNull();
    });
  });

  // ── cacheSet ───────────────────────────────────────────────────���───────────

  describe('cacheSet', () => {
    it('calls redis.setex with the correct key, ttl, and JSON-serialised value', async () => {
      vi.mocked(redis.setex).mockResolvedValueOnce('OK');
      const data = { score: 42 };

      await cacheSet('cache:ratings:w1', data, 300);

      expect(redis.setex).toHaveBeenCalledWith('cache:ratings:w1', 300, JSON.stringify(data));
    });

    it('swallows Redis errors silently', async () => {
      vi.mocked(redis.setex).mockRejectedValueOnce(new Error('redis down'));

      await expect(cacheSet('cache:ratings:w1', { score: 1 }, 300)).resolves.toBeUndefined();
    });
  });

  // ── cacheDel ───────────────────────────────────────────────────────────────

  describe('cacheDel', () => {
    it('calls redis.del with the provided keys', async () => {
      vi.mocked(redis.del).mockResolvedValueOnce(1);

      await cacheDel('cache:workers:profile:w1', 'cache:ratings:w1');

      expect(redis.del).toHaveBeenCalledWith('cache:workers:profile:w1', 'cache:ratings:w1');
    });

    it('is a no-op when called with no keys', async () => {
      await cacheDel();

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  // ── cacheOrFetch ───────────────────────────────────────────────────────────

  describe('cacheOrFetch', () => {
    it('returns the cached value without calling fetchFn on hit', async () => {
      const cached = { id: 'w1' };
      vi.mocked(redis.get).mockResolvedValueOnce(JSON.stringify(cached));
      const fetchFn = vi.fn();

      const result = await cacheOrFetch('cache:workers:profile:w1', fetchFn, 300);

      expect(result).toEqual(cached);
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('calls fetchFn on cache miss and stores the result', async () => {
      vi.mocked(redis.get).mockResolvedValueOnce(null);
      vi.mocked(redis.setex).mockResolvedValueOnce('OK');
      const fresh = { id: 'w1', name: 'Alice' };
      const fetchFn = vi.fn().mockResolvedValueOnce(fresh);

      const result = await cacheOrFetch('cache:workers:profile:w1', fetchFn, 300);

      expect(result).toEqual(fresh);
      expect(fetchFn).toHaveBeenCalledOnce();
      expect(redis.setex).toHaveBeenCalledWith(
        'cache:workers:profile:w1',
        300,
        JSON.stringify(fresh),
      );
    });
  });

  // ── cacheInvalidatePattern ─────────────────────────────────────────────────

  describe('cacheInvalidatePattern', () => {
    it('scans and deletes all matching keys', async () => {
      // First scan returns keys and a non-zero cursor, second scan terminates
      vi.mocked(redis.scan)
        .mockResolvedValueOnce(['42', ['cache:workers:list:1', 'cache:workers:list:2']])
        .mockResolvedValueOnce(['0', []]);
      vi.mocked(redis.del).mockResolvedValue(2);

      const deleted = await cacheInvalidatePattern('cache:workers:list:*');

      expect(deleted).toBe(2);
      expect(redis.del).toHaveBeenCalledWith('cache:workers:list:1', 'cache:workers:list:2');
    });

    it('returns 0 and does not call del when no keys match', async () => {
      vi.mocked(redis.scan).mockResolvedValueOnce(['0', []]);

      const deleted = await cacheInvalidatePattern('cache:workers:list:*');

      expect(deleted).toBe(0);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  // ── invalidateWorkerCache ──────────────────────────────────────────────────

  describe('invalidateWorkerCache', () => {
    it('invalidates profile, rating, availability, list, and search keys', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);
      vi.mocked(redis.scan).mockResolvedValue(['0', []]);

      await invalidateWorkerCache('w1');

      // Three exact-key deletions (profile, rating, availability)
      expect(redis.del).toHaveBeenCalledWith(CacheKeys.workerProfile('w1'));
      expect(redis.del).toHaveBeenCalledWith(CacheKeys.ratingAggregate('w1'));
      expect(redis.del).toHaveBeenCalledWith(CacheKeys.availability('w1'));
      // Pattern scans for list and search
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'cache:workers:list:*', 'COUNT', 100);
      expect(redis.scan).toHaveBeenCalledWith('0', 'MATCH', 'cache:workers:search:*', 'COUNT', 100);
    });
  });

  // ── invalidateCategoryCache ────────────────────────────────────────────────

  describe('invalidateCategoryCache', () => {
    it('invalidates the category list key', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);

      await invalidateCategoryCache();

      expect(redis.del).toHaveBeenCalledWith(CacheKeys.categoryList());
    });

    it('also deletes the specific category key when categoryId is provided', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);

      await invalidateCategoryCache('cat-1');

      expect(redis.del).toHaveBeenCalledWith(CacheKeys.categoryList());
      expect(redis.del).toHaveBeenCalledWith(CacheKeys.categoryById('cat-1'));
    });
  });

  // ── invalidateRatingCache ──────────────────────────────────────────────────

  describe('invalidateRatingCache', () => {
    it('deletes the rating aggregate key for the given worker', async () => {
      vi.mocked(redis.del).mockResolvedValue(1);

      await invalidateRatingCache('w1');

      expect(redis.del).toHaveBeenCalledWith(CacheKeys.ratingAggregate('w1'));
    });
  });
});
