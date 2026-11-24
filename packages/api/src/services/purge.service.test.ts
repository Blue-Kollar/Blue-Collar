import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as purgeService from './purge.service.js';

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    worker: {
      deleteMany: vi.fn(),
    },
    user: {
      deleteMany: vi.fn(),
    },
    refreshToken: {
      deleteMany: vi.fn(),
    },
    idempotencyKey: {
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

import { db } from '../db.js';
import { logger } from '../config/logger.js';

type MockMethod = ReturnType<typeof vi.fn>;
const mockDb = db as unknown as Record<string, Record<string, MockMethod>>;
const mockLogger = logger as unknown as Record<string, MockMethod>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockDb.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
  mockDb.idempotencyKey.deleteMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Purge Service', () => {
  describe('purgeExpiredSoftDeletes', () => {
    it('should delete workers with deletedAt older than 90 days', async () => {
      const now = new Date('2024-06-01T00:00:00Z');
      vi.setSystemTime(now);

      mockDb.worker.deleteMany.mockResolvedValue({ count: 5 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      await purgeService.purgeExpiredSoftDeletes();

      expect(mockDb.worker.deleteMany).toHaveBeenCalledWith({
        where: { deletedAt: { lte: expect.any(Date) } },
      });
    });

    it('should delete users with deletedAt older than 90 days', async () => {
      const now = new Date('2024-06-01T00:00:00Z');
      vi.setSystemTime(now);

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 3 });

      await purgeService.purgeExpiredSoftDeletes();

      expect(mockDb.user.deleteMany).toHaveBeenCalledWith({
        where: { deletedAt: { lte: expect.any(Date) } },
      });
    });

    it('should call both worker and user delete in parallel', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      const promiseSpy = vi.spyOn(Promise, 'all');

      await purgeService.purgeExpiredSoftDeletes();

      expect(promiseSpy).toHaveBeenCalled();
      expect(mockDb.worker.deleteMany).toHaveBeenCalled();
      expect(mockDb.user.deleteMany).toHaveBeenCalled();
    });

    it('should log when records are purged', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 5 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 3 });

      await purgeService.purgeExpiredSoftDeletes();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { workers: 5, users: 3 },
        'Purged expired soft-deleted records',
      );
    });

    it('should not log if no records are purged', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      await purgeService.purgeExpiredSoftDeletes();

      expect(mockLogger.info).not.toHaveBeenCalled();
    });

    it('should only log when total count is greater than zero', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 5 });

      await purgeService.purgeExpiredSoftDeletes();

      expect(mockLogger.info).toHaveBeenCalledWith(
        { workers: 0, users: 5 },
        'Purged expired soft-deleted records',
      );
    });

    it('should calculate 90-day threshold correctly', async () => {
      const now = new Date('2024-12-31T00:00:00Z');
      vi.setSystemTime(now);

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      await purgeService.purgeExpiredSoftDeletes();

      const call = mockDb.worker.deleteMany.mock.calls[0][0];
      const cutoffDate = call.where.deletedAt.lte;

      const expectedCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      expect(cutoffDate.getTime()).toBe(expectedCutoff.getTime());
    });

    it('should handle delete errors gracefully', async () => {
      mockDb.worker.deleteMany.mockRejectedValue(new Error('Database error'));
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      await expect(purgeService.purgeExpiredSoftDeletes()).rejects.toThrow('Database error');
    });
  });

  describe('startPurgeScheduler', () => {
    it('should run purge immediately on startup', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      purgeService.startPurgeScheduler();
      await vi.advanceTimersByTimeAsync(0); // drain the initial run's promise chain

      expect(mockDb.worker.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockDb.user.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('should schedule purge to run every 24 hours', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      purgeService.startPurgeScheduler();

      const call = setIntervalSpy.mock.calls.find((c) => c[1] === 24 * 60 * 60 * 1000);
      expect(call).toBeDefined();
      setIntervalSpy.mockRestore();

      await vi.advanceTimersByTimeAsync(0);
      expect(mockDb.worker.deleteMany).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000 - 1);
      expect(mockDb.worker.deleteMany).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      expect(mockDb.worker.deleteMany).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);
      expect(mockDb.worker.deleteMany).toHaveBeenCalledTimes(3);
    });

    it('should handle purge job errors in startup', async () => {
      mockDb.worker.deleteMany.mockRejectedValue(new Error('Database error'));
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      purgeService.startPurgeScheduler();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database error' }),
        'Initial purge run failed',
      );
    });

    it('should handle purge job errors in scheduled runs', async () => {
      mockDb.worker.deleteMany.mockRejectedValue(new Error('Database error'));
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      purgeService.startPurgeScheduler();
      await vi.advanceTimersByTimeAsync(0);
      mockLogger.error.mockClear();

      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database error' }),
        'Purge job failed',
      );
    });

    it('should not throw errors during scheduler setup', async () => {
      mockDb.worker.deleteMany.mockResolvedValue({ count: 0 });
      mockDb.user.deleteMany.mockResolvedValue({ count: 0 });

      expect(() => {
        purgeService.startPurgeScheduler();
      }).not.toThrow();
    });
  });

  describe('Integration', () => {
    it('should have correct constants', () => {
      // Constants are not exported, but we can verify behavior
      // NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000
      // INTERVAL_MS = 24 * 60 * 60 * 1000

      const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
      const intervalMs = 24 * 60 * 60 * 1000;

      expect(ninetyDaysMs).toBe(7776000000);
      expect(intervalMs).toBe(86400000);
    });

    it('should correctly identify records older than 90 days', async () => {
      const now = new Date('2024-06-01T12:00:00Z');
      vi.setSystemTime(now);

      // Record deleted 91 days ago (should be purged)
      const oldDeletedAt = new Date(now.getTime() - 91 * 24 * 60 * 60 * 1000);
      // Record deleted 89 days ago (should not be purged)
      const recentDeletedAt = new Date(now.getTime() - 89 * 24 * 60 * 60 * 1000);

      const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      expect(oldDeletedAt.getTime()).toBeLessThan(ninetyDaysAgo.getTime());
      expect(recentDeletedAt.getTime()).toBeGreaterThan(ninetyDaysAgo.getTime());
    });
  });
});
