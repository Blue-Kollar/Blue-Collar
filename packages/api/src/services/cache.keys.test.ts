import { describe, expect, it } from 'vitest'
import { CacheKeys, CacheTTL } from './cache.keys.js'

describe('cache.keys (#1636)', () => {
  it('builds namespaced keys for each cacheable resource', () => {
    expect(CacheKeys.workerList('page=1')).toBe('cache:workers:list:page=1')
    expect(CacheKeys.workerProfile('w1')).toBe('cache:workers:profile:w1')
    expect(CacheKeys.workerSearch('plumber')).toBe('cache:workers:search:plumber')
    expect(CacheKeys.categoryList()).toBe('cache:categories:list')
    expect(CacheKeys.categoryById('c1')).toBe('cache:categories:item:c1')
    expect(CacheKeys.ratingAggregate('w1')).toBe('cache:ratings:w1')
    expect(CacheKeys.availability('w1')).toBe('cache:availability:w1')
    expect(CacheKeys.recommendations('u1')).toBe('recommendations:u1')
  })

  it('keeps distinct resources in distinct namespaces', () => {
    expect(CacheKeys.workerProfile('x')).not.toBe(CacheKeys.availability('x'))
    expect(CacheKeys.categoryList()).not.toBe(CacheKeys.categoryById('list'))
  })

  it('exports positive TTL presets', () => {
    expect(Object.values(CacheTTL).every((ttl) => ttl > 0)).toBe(true)
    expect(CacheTTL.SHORT).toBeLessThan(CacheTTL.MEDIUM)
    expect(CacheTTL.MEDIUM).toBeLessThan(CacheTTL.LONG)
    expect(CacheTTL.RECOMMENDATIONS).toBe(1_800)
  })
})
