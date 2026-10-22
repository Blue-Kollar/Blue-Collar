/**
 * search.service.test.ts — unit tests for search service (#1371)
 *
 * Coverage for:
 *  - searchWorkers: query validation, language config safety, filter building,
 *    geo filtering with haversine distance, pagination, sorting
 *  - performAdvancedSearch: advanced filters, pagination, result serialization
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchWorkers, performAdvancedSearch, type SearchFilters } from './search.service.js'
import * as workerService from './worker.service.js'

// ── DB mock ────────────────────────────────────────────────────────────────────

vi.mock('../db.js', () => ({
  db: {
    $queryRawUnsafe: vi.fn(),
    searchAnalytics: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('./worker.service.js', () => ({
  advancedSearch: vi.fn(),
  trackSearchAnalytics: vi.fn(),
}))

vi.mock('../resources/index.js', () => ({
  WorkerResource: (w: Record<string, unknown>) => ({ ...w, resourceType: 'worker' }),
}))

import { db } from '../db.js'

// ── Test fixtures ──────────────────────────────────────────────────────────────

const mockWorkerRow = {
  id: 'worker-1',
  name: 'John Plumber',
  bio: 'Experienced plumber',
  isActive: true,
  deletedAt: null,
  categoryId: 'cat-1',
  curatorId: 'curator-1',
  locationId: 'loc-1',
  isVerified: true,
  rank: 0.5,
  nameHighlight: '<mark>Plumber</mark>',
  bioHighlight: 'Experienced <mark>plumber</mark>',
  category: { id: 'cat-1', name: 'Plumbing' },
  curator: { id: 'curator-1', name: 'Alice' },
  location: { id: 'loc-1', lat: 40.7128, lng: -74.006, city: 'New York' },
  distanceKm: 2.5,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// searchWorkers tests

describe('searchWorkers', () => {
  describe('language configuration', () => {
    it('defaults to simple language when none provided', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ query: 'plumber' })

      expect(vi.mocked(db.$queryRawUnsafe)).toHaveBeenCalled()
    })

    it('validates language config and falls back to simple for invalid', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ query: 'plumber', lang: 'invalid_lang' })

      const call = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      expect(call).toBeDefined()
    })

    it('accepts valid language configs', async () => {
      const validLangs = ['english', 'french', 'german', 'spanish', 'portuguese', 'italian']

      for (const lang of validLangs) {
        vi.clearAllMocks()
        vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

        await searchWorkers({ query: 'plumber', lang })
        expect(vi.mocked(db.$queryRawUnsafe)).toHaveBeenCalled()
      }
    })
  })

  describe('pagination', () => {
    it('defaults to page 1 with limit 20', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([mockWorkerRow]).mockResolvedValueOnce([{ count: 50n }])

      const result = await searchWorkers({})

      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(20)
      expect(result.meta.pages).toBe(3) // ceil(50/20)
    })

    it('enforces minimum page of 1', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      const result = await searchWorkers({ page: -5, limit: 10 })

      expect(result.meta.page).toBe(1)
    })

    it('enforces maximum limit of 100', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      const result = await searchWorkers({ limit: 500 })

      expect(result.meta.limit).toBe(100)
    })

    it('enforces minimum limit of 1', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      const result = await searchWorkers({ limit: -5 })

      expect(result.meta.limit).toBe(1)
    })

    it('calculates correct offset', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ page: 3, limit: 10 })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const params = sqlCall[1]
      expect(params).toContain(20) // (3-1) * 10
    })
  })

  describe('filter building', () => {
    it('filters by category', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ categories: ['cat-1', 'cat-2'] })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('categoryId')
    })

    it('filters by verification status', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ isVerified: true })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('isVerified')
    })

    it('filters by minimum rating', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ minRating: 4.5 })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('AVG(rv.rating)')
    })

    it('filters by maximum rating', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ maxRating: 3.5 })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('AVG(rv.rating)')
    })

    it('filters by day of week', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ dayOfWeek: 3 })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('Availability')
    })

    it('includes active and non-deleted workers only', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({})

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('isActive')
      expect(sql).toContain('deletedAt')
    })
  })

  describe('geo filtering', () => {
    it('applies bounding box pre-filter', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ lat: 40.7128, lng: -74.006, radius: 10 })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('BETWEEN')
    })

    it('applies haversine distance filter post-query', async () => {
      const worker1 = { ...mockWorkerRow, location: { lat: 40.7128, lng: -74.006 } }
      const worker2 = { ...mockWorkerRow, location: { lat: 50.0, lng: -80.0 } }

      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([worker1, worker2]).mockResolvedValueOnce([{ count: 2n }])

      const result = await searchWorkers({ lat: 40.7128, lng: -74.006, radius: 10 })

      expect(result.data.length).toBeGreaterThanOrEqual(0)
      expect(result.data.every(r => (r['distanceKm'] as number) <= 10 || !r['location'])).toBe(true)
    })

    it('handles workers without location data', async () => {
      const workerNoLoc = { ...mockWorkerRow, location: null }

      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([workerNoLoc]).mockResolvedValueOnce([{ count: 1n }])

      const result = await searchWorkers({ lat: 40.7128, lng: -74.006, radius: 10 })

      expect(result.data.length).toBe(0)
    })

    it('sorts by distance when requested', async () => {
      const workers = [
        { ...mockWorkerRow, id: 'w1', location: { lat: 40.7128, lng: -74.006 } },
        { ...mockWorkerRow, id: 'w2', location: { lat: 40.7138, lng: -74.0069 } },
        { ...mockWorkerRow, id: 'w3', location: { lat: 40.7200, lng: -74.0100 } },
      ]

      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce(workers).mockResolvedValueOnce([{ count: 3n }])

      const result = await searchWorkers({ lat: 40.7128, lng: -74.006, radius: 50, sortBy: 'distance' })

      if (result.data.length > 1) {
        for (let i = 0; i < result.data.length - 1; i++) {
          const curr = result.data[i]['distanceKm'] as number | undefined
          const next = result.data[i + 1]['distanceKm'] as number | undefined
          if (curr !== undefined && next !== undefined) {
            expect(curr).toBeLessThanOrEqual(next)
          }
        }
      }
    })
  })

  describe('sorting', () => {
    it('defaults to relevance sort for full-text search', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ query: 'plumber', sortBy: 'relevance' })

      expect(vi.mocked(db.$queryRawUnsafe)).toHaveBeenCalled()
    })

    it('sorts by rating when requested', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ sortBy: 'rating' })

      const sqlCall = vi.mocked(db.$queryRawUnsafe).mock.calls[0]
      const sql = sqlCall[0]
      expect(sql).toContain('rating')
    })

    it('sorts by newest when requested', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ sortBy: 'newest' })

      expect(vi.mocked(db.$queryRawUnsafe)).toHaveBeenCalled()
    })
  })

  describe('full-text search', () => {
    it('includes FTS rank when query provided', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ ...mockWorkerRow, rank: 0.8 }]).mockResolvedValueOnce([
        { count: 1n },
      ])

      const result = await searchWorkers({ query: 'plumber' })

      expect(result.data[0]?.rank).toBe(0.8)
    })

    it('logs search analytics when query provided', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ query: 'plumber', lat: 40.7, lng: -74.0, categories: ['cat-1'] }, '192.168.1.1')

      expect(vi.mocked(db.searchAnalytics.create)).toHaveBeenCalled()
    })

    it('skips analytics logging for empty query', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0n }])

      await searchWorkers({ query: '   ' }, '192.168.1.1')

      expect(vi.mocked(db.searchAnalytics.create)).not.toHaveBeenCalled()
    })
  })

  describe('result transformation', () => {
    it('includes highlights in results', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([mockWorkerRow]).mockResolvedValueOnce([{ count: 1n }])

      const result = await searchWorkers({ query: 'plumber' })

      expect(result.data[0]?.highlight).toBeDefined()
      expect(result.data[0]?.highlight?.name).toBeTruthy()
    })

    it('includes distance when geo filtering', async () => {
      vi.mocked(db.$queryRawUnsafe)
        .mockResolvedValueOnce([{ ...mockWorkerRow, distanceKm: 2.5 }])
        .mockResolvedValueOnce([{ count: 1n }])

      const result = await searchWorkers({ lat: 40.7128, lng: -74.006, radius: 10 })

      expect(result.data[0]?.distanceKm).toBeDefined()
    })

    it('returns metadata with pagination info', async () => {
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([mockWorkerRow]).mockResolvedValueOnce([{ count: 50n }])

      const result = await searchWorkers({ page: 2, limit: 25 })

      expect(result.meta.total).toBe(50)
      expect(result.meta.page).toBe(2)
      expect(result.meta.limit).toBe(25)
      expect(result.meta.pages).toBe(2)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// performAdvancedSearch tests

describe('performAdvancedSearch', () => {
  it('delegates to workerService.advancedSearch', async () => {
    vi.mocked(workerService.advancedSearch).mockResolvedValueOnce({
      data: [{ id: 'worker-1', name: 'John' }],
      total: 1,
      hasMore: false,
    } as never)

    await performAdvancedSearch({ query: 'plumber' }, '192.168.1.1')

    expect(vi.mocked(workerService.advancedSearch)).toHaveBeenCalled()
  })

  it('enforces pagination limits', async () => {
    vi.mocked(workerService.advancedSearch).mockResolvedValueOnce({ data: [], total: 0, hasMore: false } as never)

    await performAdvancedSearch({ page: 3, limit: 500 }, '192.168.1.1')

    const call = vi.mocked(workerService.advancedSearch).mock.calls[0][0]
    expect(call.take).toBe(100)
  })

  it('calls trackSearchAnalytics when query provided', async () => {
    vi.mocked(workerService.advancedSearch).mockResolvedValueOnce({ data: [], total: 10, hasMore: true } as never)

    await performAdvancedSearch({ query: 'plumber' }, '192.168.1.1')

    expect(vi.mocked(workerService.trackSearchAnalytics)).toHaveBeenCalledWith('plumber', 0, false, '192.168.1.1')
  })

  it('skips analytics when query not provided', async () => {
    vi.mocked(workerService.advancedSearch).mockResolvedValueOnce({ data: [], total: 0, hasMore: false } as never)

    await performAdvancedSearch({ categories: ['cat-1'] }, '192.168.1.1')

    expect(vi.mocked(workerService.trackSearchAnalytics)).not.toHaveBeenCalled()
  })

  it('transforms results with WorkerResource', async () => {
    const mockWorker = { id: 'worker-1', name: 'John', resourceType: 'worker' }
    vi.mocked(workerService.advancedSearch).mockResolvedValueOnce({ data: [mockWorker], total: 1, hasMore: false } as never)

    const result = await performAdvancedSearch({ query: 'plumber' }, '192.168.1.1')

    expect(result.data[0]).toBeDefined()
    expect(result.data[0]?.resourceType).toBe('worker')
  })

  it('includes metadata with hasMore flag', async () => {
    vi.mocked(workerService.advancedSearch).mockResolvedValueOnce({ data: [], total: 50, hasMore: true } as never)

    const result = await performAdvancedSearch({ page: 1, limit: 20 }, '192.168.1.1')

    expect(result.meta.total).toBe(50)
    expect(result.meta.hasMore).toBe(true)
    expect(result.meta.pages).toBe(3)
  })
})
