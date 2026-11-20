/**
 * cacheOrFetch TTL and category invalidation behaviour (#1830).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const redisMock = vi.hoisted(() => ({
  get: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
}))
vi.mock('@/config/redis.js', () => ({ redis: redisMock }))

import { cacheOrFetch, invalidateCategoryCache } from './cache.service'
import { CacheKeys } from './cache.keys'

describe('cacheOrFetch (#1830)', () => {
  beforeEach(() => {
    redisMock.get.mockReset()
    redisMock.setex.mockReset().mockResolvedValue('OK')
    redisMock.del.mockReset().mockResolvedValue(1)
  })

  it('returns the cached value and skips the fetch on a hit', async () => {
    redisMock.get.mockResolvedValue(JSON.stringify({ id: 'w-1' }))
    const fetchFn = vi.fn()

    const result = await cacheOrFetch('cache:workers:profile:w-1', fetchFn, 60)

    expect(result).toEqual({ id: 'w-1' })
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('fetches and stores the value with the given TTL on a miss', async () => {
    redisMock.get.mockResolvedValue(null)
    const fetchFn = vi.fn().mockResolvedValue({ id: 'w-2' })

    const result = await cacheOrFetch('cache:workers:profile:w-2', fetchFn, 300)

    expect(result).toEqual({ id: 'w-2' })
    expect(fetchFn).toHaveBeenCalledTimes(1)
    expect(redisMock.setex).toHaveBeenCalledWith(
      'cache:workers:profile:w-2',
      300,
      JSON.stringify({ id: 'w-2' }),
    )
  })
})

describe('invalidateCategoryCache (#1830)', () => {
  beforeEach(() => {
    redisMock.del.mockReset().mockResolvedValue(1)
  })

  it('deletes the category list key and the category-specific key', async () => {
    await invalidateCategoryCache('cat-7')

    expect(redisMock.del).toHaveBeenCalledWith(CacheKeys.categoryList())
    expect(redisMock.del).toHaveBeenCalledWith(CacheKeys.categoryById('cat-7'))
  })
})
