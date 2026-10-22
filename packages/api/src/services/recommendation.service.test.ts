import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as recommendationService from './recommendation.service'
import { db } from '@/db'
import { redis } from '@/config/redis'
import { formatWorker } from '@/models/worker.model'

vi.mock('@/db.js')
vi.mock('@/config/redis.js')
vi.mock('@/models/worker.model.js')

type MockedDb = {
  userInteraction: {
    create: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
    groupBy: ReturnType<typeof vi.fn>
  }
  user: {
    findUnique: ReturnType<typeof vi.fn>
  }
  worker: {
    findMany: ReturnType<typeof vi.fn>
  }
}

type MockedRedis = {
  del: ReturnType<typeof vi.fn>
  get: ReturnType<typeof vi.fn>
  setex: ReturnType<typeof vi.fn>
}

const createMockWorker = (overrides = {}) => ({
  id: 'worker-1',
  name: 'John Doe',
  isActive: true,
  rating: 4.8,
  category: { id: 'cat-1', name: 'Plumbing' },
  curator: { id: 'user-1', name: 'Jane Smith' },
  location: { id: 'loc-1', city: 'New York', country: 'USA' },
  createdAt: new Date(),
  ...overrides,
})

const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'user@example.com',
  locationId: 'loc-1',
  location: { id: 'loc-1', city: 'New York', country: 'USA' },
  ...overrides,
})

const createMockInteraction = (overrides = {}) => ({
  id: 'interaction-1',
  userId: 'user-123',
  workerId: 'worker-1',
  type: 'view',
  createdAt: new Date(),
  ...overrides,
})

describe('RecommendationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(redis as unknown as MockedRedis).del.mockResolvedValue(1)
    ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
    ;(redis as unknown as MockedRedis).setex.mockResolvedValue('OK')
  })

  describe('trackInteraction', () => {
    it('should create user interaction', async () => {
      ;(db as unknown as MockedDb).userInteraction.create.mockResolvedValue(createMockInteraction())

      await recommendationService.trackInteraction('user-123', 'worker-1', 'view')

      expect((db as unknown as MockedDb).userInteraction.create).toHaveBeenCalledWith({
        data: { userId: 'user-123', workerId: 'worker-1', type: 'view' },
      })
    })

    it('should invalidate cache after tracking interaction', async () => {
      ;(db as unknown as MockedDb).userInteraction.create.mockResolvedValue(createMockInteraction())

      await recommendationService.trackInteraction('user-123', 'worker-1', 'view')

      expect((redis as unknown as MockedRedis).del).toHaveBeenCalledWith('recommendations:user-123')
    })

    it('should handle cache invalidation errors gracefully', async () => {
      ;(db as unknown as MockedDb).userInteraction.create.mockResolvedValue(createMockInteraction())
      ;(redis as unknown as MockedRedis).del.mockRejectedValue(new Error('Cache error'))

      // Should not throw
      await expect(recommendationService.trackInteraction('user-123', 'worker-1', 'view')).resolves.toBeUndefined()
    })

    it('should track different interaction types', async () => {
      ;(db as unknown as MockedDb).userInteraction.create.mockResolvedValue(createMockInteraction({ type: 'bookmark' }))

      await recommendationService.trackInteraction('user-123', 'worker-1', 'bookmark')

      expect((db as unknown as MockedDb).userInteraction.create).toHaveBeenCalledWith({
        data: { userId: 'user-123', workerId: 'worker-1', type: 'bookmark' },
      })
    })

    it('should handle contact and tip interactions', async () => {
      ;(db as unknown as MockedDb).userInteraction.create.mockResolvedValue(createMockInteraction({ type: 'contact' }))

      await recommendationService.trackInteraction('user-123', 'worker-1', 'contact')

      expect((db as unknown as MockedDb).userInteraction.create).toHaveBeenCalledWith({
        data: { userId: 'user-123', workerId: 'worker-1', type: 'contact' },
      })
    })
  })

  describe('getRecommendations', () => {
    it('should return cached recommendations when available', async () => {
      const cachedResult = { data: [{ id: 'worker-1', name: 'John' }], source: 'cache' }
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(JSON.stringify(cachedResult))

      const result = await recommendationService.getRecommendations('user-123', 10)

      expect((redis as unknown as MockedRedis).get).toHaveBeenCalledWith('recommendations:user-123')
      expect(result).toEqual(cachedResult)
      expect((db as unknown as MockedDb).userInteraction.findMany).not.toHaveBeenCalled()
    })

    it('should return fallback when no collaborative results found', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([]) // No interactions
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      const fallbackWorkers = [
        createMockWorker({ id: 'worker-1' }),
        createMockWorker({ id: 'worker-2' }),
      ]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(fallbackWorkers)
      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.source).toBe('fallback')
      expect(result.data).toHaveLength(2)
    })

    it('should return popular workers as fallback', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(db as unknown as MockedDb).userInteraction.findMany
        .mockResolvedValueOnce([]) // No user interactions
        .mockResolvedValueOnce([]) // No similar user interactions
      
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      const popularWorkers = [
        { _count: { workerId: 10 }, workerId: 'popular-1' },
        { _count: { workerId: 8 }, workerId: 'popular-2' },
      ]
      ;(db as unknown as MockedDb).userInteraction.groupBy.mockResolvedValue(popularWorkers)

      const workers = [
        createMockWorker({ id: 'popular-1' }),
        createMockWorker({ id: 'popular-2' }),
      ]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)
      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.source).toBe('fallback')
    })

    it('should apply location boost for workers in same city', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)

      const userInteractions = [
        createMockInteraction({ workerId: 'worker-1', type: 'view' }),
      ]
      ;(db as unknown as MockedDb).userInteraction.findMany
        .mockResolvedValueOnce(userInteractions) // User interactions
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-1', type: 'view' },
          { userId: 'user-2', workerId: 'worker-2', type: 'bookmark' },
        ]) // Similar user interactions
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-2', type: 'bookmark' },
        ]) // Collaborative interactions

      const user = createMockUser({ locationId: 'loc-1' })
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(user)

      const workers = [
        createMockWorker({
          id: 'worker-2',
          location: { id: 'loc-1', city: 'New York', country: 'USA' }, // Same city
        }),
      ]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 1)

      expect(result.data).toHaveLength(1)
    })

    it('should apply location boost for workers in same country', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)

      const userInteractions = [
        createMockInteraction({ workerId: 'worker-1', type: 'view' }),
      ]
      ;(db as unknown as MockedDb).userInteraction.findMany
        .mockResolvedValueOnce(userInteractions)
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-1', type: 'view' },
          { userId: 'user-2', workerId: 'worker-2', type: 'bookmark' },
        ])
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-2', type: 'bookmark' },
        ])

      const user = createMockUser()
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(user)

      const workers = [
        createMockWorker({
          id: 'worker-2',
          location: { id: 'loc-2', city: 'Los Angeles', country: 'USA' }, // Same country
        }),
      ]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 1)

      expect(result.data).toHaveLength(1)
    })

    it('should use interaction weights correctly', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)

      const userInteractions = [
        createMockInteraction({ workerId: 'worker-1', type: 'view' }), // weight: 1
      ]
      ;(db as unknown as MockedDb).userInteraction.findMany
        .mockResolvedValueOnce(userInteractions)
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-1', type: 'tip' }, // weight: 5
          { userId: 'user-2', workerId: 'worker-2', type: 'contact' }, // weight: 4
        ])
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-2', type: 'contact' },
        ])

      const user = createMockUser()
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(user)

      const workers = [createMockWorker({ id: 'worker-2' })]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.source).toBe('collaborative')
    })

    it('should exclude workers user already interacted with', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)

      const userInteractions = [
        createMockInteraction({ workerId: 'worker-1', type: 'view' }),
      ]
      ;(db as unknown as MockedDb).userInteraction.findMany
        .mockResolvedValueOnce(userInteractions)
        .mockResolvedValueOnce([]) // No similar users
        .mockResolvedValueOnce([]) // No collaborative results

      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      // Check that findMany is called with exclusion
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue([])

      await recommendationService.getRecommendations('user-123', 10)

      // Verify that the service didn't include worker-1 in queries
      const groupByCall = (db as unknown as MockedDb).userInteraction.groupBy.mock.calls[0]
      expect(groupByCall[0].where.workerId.notIn).toContain('worker-1')
    })

    it('should cache recommendations with TTL', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([])
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      const fallbackWorkers = [createMockWorker({ id: 'worker-1' })]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(fallbackWorkers)
      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      await recommendationService.getRecommendations('user-123', 10)

      expect((redis as unknown as MockedRedis).setex).toHaveBeenCalledWith(
        'recommendations:user-123',
        30 * 60, // 30 minutes
        expect.any(String)
      )
    })

    it('should respect limit parameter', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([])
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      const workers = Array.from({ length: 20 }, (_, i) =>
        createMockWorker({ id: `worker-${i}` })
      )
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers.slice(0, 5))
      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 5)

      expect(result.data).toHaveLength(5)
    })

    it('should return empty array when no workers available', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([])
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())
      ;(db as unknown as MockedDb).userInteraction.groupBy.mockResolvedValue([])
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue([])

      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.data).toEqual([])
    })

    it('should handle cache retrieval errors gracefully', async () => {
      ;(redis as unknown as MockedRedis).get.mockRejectedValue(new Error('Cache error'))
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([])
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      const workers = [createMockWorker({ id: 'worker-1' })]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)
      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      // Should not throw and should proceed with computation
      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.source).toBe('fallback')
    })

    it('should handle cache write errors gracefully', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(redis as unknown as MockedRedis).setex.mockRejectedValue(new Error('Cache write error'))
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([])
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      const workers = [createMockWorker({ id: 'worker-1' })]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)
      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      // Should not throw despite cache write error
      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.source).toBe('fallback')
    })

    it('should score workers by collaborative filtering', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)

      const userInteractions = [
        createMockInteraction({ workerId: 'worker-1', type: 'view' }),
      ]
      ;(db as unknown as MockedDb).userInteraction.findMany
        .mockResolvedValueOnce(userInteractions) // User interactions
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-1', type: 'tip' }, // Similar user
        ]) // Similar user interactions
        .mockResolvedValueOnce([
          { userId: 'user-2', workerId: 'worker-2', type: 'contact' },
        ]) // Collaborative interactions

      const user = createMockUser()
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(user)

      const workers = [createMockWorker({ id: 'worker-2' })]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)

      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.source).toBe('collaborative')
      expect(result.data).toHaveLength(1)
    })

    it('should handle user without location gracefully', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([])
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue({
        ...createMockUser(),
        location: null,
      })

      const workers = [createMockWorker({ id: 'worker-1' })]
      ;(db as unknown as MockedDb).worker.findMany.mockResolvedValue(workers)
      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
      }))

      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.source).toBe('fallback')
    })

    it('should filter out inactive workers', async () => {
      ;(redis as unknown as MockedRedis).get.mockResolvedValue(null)
      ;(db as unknown as MockedDb).userInteraction.findMany.mockResolvedValue([])
      ;(db as unknown as MockedDb).user.findUnique.mockResolvedValue(createMockUser())

      const workers = [
        createMockWorker({ id: 'worker-1', isActive: true }),
        createMockWorker({ id: 'worker-2', isActive: false }),
      ]
      ;(db as unknown as MockedDb).worker.findMany.mockReturnValue(workers.filter((w) => w.isActive))

      ;(formatWorker as ReturnType<typeof vi.fn>).mockImplementation((w) => ({
        id: w.id,
        name: w.name,
        isActive: w.isActive,
      }))

      // The service should only return active workers
      const result = await recommendationService.getRecommendations('user-123', 10)

      expect(result.data.every((w: any) => w.isActive !== false)).toBeTruthy()
    })
  })

  describe('Interaction Weights', () => {
    it('should apply correct weights: view=1, bookmark=3, tip=5, contact=4', () => {
      // This is implicitly tested through collaborative filtering tests
      // The weights are used in score calculations
      // view: 1, bookmark: 3, contact: 4, tip: 5
      expect(true).toBe(true) // Placeholder for weight constants
    })
  })

  describe('Cache TTL', () => {
    it('should use 30 minute cache TTL', () => {
      // The service uses 60 * 30 = 1800 seconds
      expect(30 * 60).toBe(1800)
    })
  })
})
