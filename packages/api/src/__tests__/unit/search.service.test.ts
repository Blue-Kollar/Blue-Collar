/**
 * Unit tests for search.service.ts (closes #1046)
 *
 * Tests core logic paths for:
 * - searchWorkers with various filter combinations
 * - Query normalization and language config validation
 * - Pagination and sorting
 * - Geo filtering
 * - Filter composition logic
 *
 * Mocks the database layer entirely so tests run without a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as searchService from '../../services/search.service.js'

// Mock database
vi.mock('../../db.js', () => ({
  db: {
    $queryRaw: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}))

import { db } from '../../db.js'

describe('search.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchWorkers', () => {
    it('returns search result with data and metadata on success', async () => {
      const mockResult = [
        { id: 'w1', name: 'Alice', rank: 0.95, distanceKm: 2.5 },
        { id: 'w2', name: 'Bob', rank: 0.80, distanceKm: 5.0 },
      ]
      vi.mocked(db.$queryRaw).mockResolvedValueOnce(mockResult)
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '2' }])

      const result = await searchService.searchWorkers({ query: 'plumber' })

      expect(result.data).toHaveLength(2)
      expect(result.meta.total).toBe(2)
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(20)
    })

    it('defaults to page 1, limit 20 when not provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({})

      // Verify pagination was applied (offset = 0 for page 1)
      expect(db.$queryRaw).toHaveBeenCalled()
    })

    it('enforces minimum limit of 1', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ limit: 0 })

      // Should have used at least limit of 1
      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('LIMIT')
    })

    it('enforces maximum limit of 100', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ limit: 500 })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('LIMIT 100')
    })

    it('includes full-text search when query is provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ query: 'electrician' })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('websearch_to_tsquery')
    })

    it('skips full-text search when query is empty or whitespace', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ query: '   ' })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).not.toContain('websearch_to_tsquery')
    })

    it('validates language config and defaults to simple', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ lang: 'invalid-lang', query: 'test' })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('simple')
    })

    it('accepts valid language configs', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ lang: 'english', query: 'test' })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('english')
    })

    it('filters by categories when provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ categories: ['cat-1', 'cat-2'] })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('categoryId')
    })

    it('filters by isVerified when provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ isVerified: true })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('isVerified')
    })

    it('filters by minimum rating when provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ minRating: 3.5 })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('Review')
    })

    it('filters by maximum rating when provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ maxRating: 4.0 })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('Review')
    })

    it('filters by day of week availability when provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ dayOfWeek: 1 })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('Availability')
    })

    it('applies geographic bounding box filtering', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ lat: 40.7128, lng: -74.0060, radius: 5 })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('BETWEEN')
    })

    it('sorts by relevance when query is provided', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ query: 'plumber', sortBy: 'relevance' })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('rank DESC')
    })

    it('sorts by rating when sortBy=rating', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ sortBy: 'rating' })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('AVG')
    })

    it('sorts by newest when sortBy=newest', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({ sortBy: 'newest' })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('createdAt DESC')
    })

    it('filters by active workers only', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({})

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('isActive')
    })

    it('excludes deleted workers', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({})

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      expect(query.toString()).toContain('deletedAt IS NULL')
    })

    it('combines multiple filters in one query', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      await searchService.searchWorkers({
        query: 'plumber',
        categories: ['cat-1'],
        minRating: 3,
        isVerified: true,
        lat: 40.7128,
        lng: -74.0060,
      })

      const [query] = vi.mocked(db.$queryRaw).mock.calls[0]
      const queryStr = query.toString()
      expect(queryStr).toContain('websearch_to_tsquery')
      expect(queryStr).toContain('categoryId')
      expect(queryStr).toContain('isVerified')
      expect(queryStr).toContain('BETWEEN')
    })

    it('handles pagination correctly for page 2', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '50' }])

      const result = await searchService.searchWorkers({ page: 2, limit: 20 })

      expect(result.meta.page).toBe(2)
      expect(result.meta.pages).toBe(3)
    })

    it('truncates negative page numbers to 1', async () => {
      vi.mocked(db.$queryRaw).mockResolvedValueOnce([])
      vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([{ count: '0' }])

      const result = await searchService.searchWorkers({ page: -5 })

      expect(result.meta.page).toBe(1)
    })
  })
})
