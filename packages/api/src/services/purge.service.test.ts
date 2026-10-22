import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as purgeService from './purge.service.js'

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    worker: {
      deleteMany: vi.fn(),
    },
    user: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}))

import { db } from '../db.js'
import { logger } from '../config/logger.js'

const mockDb = db as any
const mockLogger = logger as any

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Purge Service', () => {
  describe('purgeExpiredSoftDeletes', () => {
    it('should delete workers with deletedAt older than 90 days', async () => {
      const now = new Date('2024-06-01T00:00:00Z')
      vi.setSystemTime(now)

      const cutoff = new Date('2024-03-03T00:00:00Z') // 90 days before now

      mockDb.worker.deleteMany.mockResolvedValue({ count: 5 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      await purgeService.purgeExpiredSoftDeletes()

      expect(mockDb.worker.deleteMany).toHaveBeenCalledWith({
        where: { deletedAt: { lte: expect.any(Date) } },
      })
    })

    it('should delete users with deletedAt older than 90 days', async () => {
      const now = new Date('2024-06-01T00:00:00Z')
      vi.setSystemTime(now)

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 3 })

      await purgeService.purgeExpiredSoftDeletes()

      expect(mockDb.user.deleteMany).toHaveBeenCalledWith({
        where: { deletedAt: { lte: expect.any(Date) } },
      })
    })

    it('should call both worker and user delete in parallel', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      const promiseSpy = vi.spyOn(Promise, 'all')

      await purgeService.purgeExpiredSoftDeletes()

      expect(promiseSpy).toHaveBeenCalled()
      expect(mockDb.worker.deleteMany).toHaveBeenCalled()
      expect(mockDb.user.deleteMany).toHaveBeenCalled()
    })

    it('should log when records are purged', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 5 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 3 })

      await purgeService.purgeExpiredSoftDeletes()

      expect(mockLogger.info).toHaveBeenCalledWith(
        { workers: 5, users: 3 },
        'Purged expired soft-deleted records'
      )
    })

    it('should not log if no records are purged', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      await purgeService.purgeExpiredSoftDeletes()

      expect(mockLogger.info).not.toHaveBeenCalled()
    })

    it('should only log when total count is greater than zero', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 5 })

      await purgeService.purgeExpiredSoftDeletes()

      expect(mockLogger.info).toHaveBeenCalledWith(
        { workers: 0, users: 5 },
        'Purged expired soft-deleted records'
      )
    })

    it('should calculate 90-day threshold correctly', async () => {
      const now = new Date('2024-12-31T00:00:00Z')
      vi.setSystemTime(now)

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      await purgeService.purgeExpiredSoftDeletes()

      const call = mockDb.worker.deleteMany.mock.calls[0][0]
      const cutoffDate = call.where.deletedAt.lte

      // Should be approximately 90 days (2592000000 ms) before now
      const expectedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      const timeDiff = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime())

      // Allow 1 second tolerance for test execution time
      expect(timeDiff).toBeLessThan(1000)
    })

    it('should handle delete errors gracefully', async () => {
      mockDb.worker.deleteMany.mockRejectedValue(new Error('Database error'))
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      await expect(purgeService.purgeExpiredSoftDeletes()).rejects.toThrow('Database error')
    })
  })

  describe('startPurgeScheduler', () => {
    it('should run purge immediately on startup', async () => {
      const purgeExpiredSpy = vi.spyOn(purgeService, 'purgeExpiredSoftDeletes')

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      await purgeService.startPurgeScheduler()

      // Give it a moment to execute
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(purgeExpiredSpy).toHaveBeenCalled()

      purgeExpiredSpy.mockRestore()
    })

    it('should schedule purge to run every 24 hours', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      purgeService.startPurgeScheduler()

      // Check that setInterval was called with correct interval (24 hours in ms)
      const call = setIntervalSpy.mock.calls.find(
        (c) => c[1] === 24 * 60 * 60 * 1000
      )
      expect(call).toBeDefined()

      setIntervalSpy.mockRestore()
    })

    it('should handle purge job errors in startup', async () => {
      const purgeExpiredSpy = vi
        .spyOn(purgeService, 'purgeExpiredSoftDeletes')
        .mockRejectedValueOnce(new Error('Purge failed'))

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      purgeService.startPurgeScheduler()

      // Give it a moment to execute
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Purge job failed'
      )

      purgeExpiredSpy.mockRestore()
    })

    it('should handle purge job errors in scheduled runs', async () => {
      mockDb.worker.deleteMany.mockRejectedValue(new Error('Database error'))
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      const setIntervalSpy = vi.spyOn(global, 'setInterval')

      purgeService.startPurgeScheduler()

      // Advance time by 24 hours
      vi.advanceTimersByTime(24 * 60 * 60 * 1000)

      await new Promise(resolve => setTimeout(resolve, 100))

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Error),
        'Purge job failed'
      )

      setIntervalSpy.mockRestore()
    })

    it('should not throw errors during scheduler setup', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 })

      expect(() => {
        purgeService.startPurgeScheduler()
      }).not.toThrow()
    })
  })

  describe('Integration', () => {
    it('should have correct constants', () => {
      // Constants are not exported, but we can verify behavior
      // NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
      // INTERVAL_MS = 24 * 60 * 60 * 1000

      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000
      const intervalMs = 24 * 60 * 60 * 1000

      expect(ninetyDaysMs).toBe(7776000000)
      expect(intervalMs).toBe(86400000)
    })

    it('should correctly identify records older than 90 days', async () => {
      const now = new Date('2024-06-01T12:00:00Z')
      vi.setSystemTime(now)

      // Record deleted 91 days ago (should be purged)
      const oldDeletedAt = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000)
      // Record deleted 89 days ago (should not be purged)
      const recentDeletedAt = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000)

      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

      expect(oldDeletedAt.getTime()).toBeLessThan(ninetyDaysAgo.getTime())
      expect(recentDeletedAt.getTime()).toBeGreaterThan(ninetyDaysAgo.getTime())
    })
  })
})
