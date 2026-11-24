/**
 * Unit tests for the shared cache/queue helpers (issue #1874).
 *
 * All timing assertions are deterministic: fake timers pin `Date.now()` for
 * the default-argument path, so no test depends on the wall clock or network.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  createCacheKey,
  isCacheEntryExpired,
  DEFAULT_CACHE_TTL_MS,
  type CacheEntry,
  type CacheOptions,
  type QueueJob,
  type QueueOptions,
} from '../utils/cache.js';
import * as sdk from '../index.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('utils/cache — constants', () => {
  it('DEFAULT_CACHE_TTL_MS is five minutes', () => {
    expect(DEFAULT_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });
});

describe('utils/cache — createCacheKey', () => {
  it('joins key parts with a colon', () => {
    expect(createCacheKey('cache', 'worker', 'GABC')).toBe('cache:worker:GABC');
  });

  it('drops empty, null and undefined segments', () => {
    expect(createCacheKey('cache', '', undefined, null, 'categories')).toBe('cache:categories');
  });

  it('stringifies numeric segments', () => {
    expect(createCacheKey('page', 2, 10)).toBe('page:2:10');
  });

  it('returns a single part unchanged', () => {
    expect(createCacheKey('cache:categories')).toBe('cache:categories');
  });

  it('returns an empty string when no parts are supplied', () => {
    expect(createCacheKey()).toBe('');
  });
});

describe('utils/cache — isCacheEntryExpired', () => {
  const entry: CacheEntry<string> = {
    data: 'payload',
    timestamp: 1_000,
    ttl: 500,
    staleTime: 100,
  };

  it('is false while the entry is younger than its ttl', () => {
    expect(isCacheEntryExpired(entry, 1_499)).toBe(false);
  });

  it('is true at exactly the ttl boundary', () => {
    expect(isCacheEntryExpired(entry, 1_500)).toBe(true);
  });

  it('is true once the ttl has elapsed', () => {
    expect(isCacheEntryExpired(entry, 1_501)).toBe(true);
  });

  it('accepts entries with only timestamp and ttl metadata', () => {
    expect(isCacheEntryExpired({ timestamp: 100, ttl: 10 }, 105)).toBe(false);
  });

  it('uses Date.now() when no timestamp is supplied', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_499);
    expect(isCacheEntryExpired(entry)).toBe(false);

    vi.setSystemTime(1_500);
    expect(isCacheEntryExpired(entry)).toBe(true);
  });
});

describe('utils/cache — shared type shapes', () => {
  it('exposes usable cache and queue interfaces', () => {
    const cacheOptions: CacheOptions = { ttl: 1_000, staleTime: 100 };
    const queueOptions: QueueOptions = { maxRetries: 3, retryDelayMs: 500, maxQueueSize: 50 };
    const job: QueueJob<{ id: string }> = {
      id: 'job-1',
      type: 'tip',
      payload: { id: 'worker-1' },
      createdAt: 1_000,
      retries: 0,
      maxRetries: queueOptions.maxRetries ?? 3,
      status: 'pending',
    };

    expect(cacheOptions.ttl).toBe(1_000);
    expect(job.payload.id).toBe('worker-1');
    expect(job.retries).toBeLessThan(job.maxRetries);
  });
});

describe('utils/cache — public entrypoint', () => {
  it('re-exports the cache helpers from the SDK root', () => {
    expect(sdk.createCacheKey).toBe(createCacheKey);
    expect(sdk.isCacheEntryExpired).toBe(isCacheEntryExpired);
    expect(sdk.DEFAULT_CACHE_TTL_MS).toBe(DEFAULT_CACHE_TTL_MS);
  });
});
