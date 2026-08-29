import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError } from './AppError.js'

vi.mock('../db.js', () => ({
  db: {
    worker: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
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
    notification: {
      deleteMany: vi.fn(),
    },
  },
}))

vi.mock('../models/worker.model.js', () => ({
  formatWorker: (w: any) => w,
}))

vi.mock('./webhook.service.js', () => ({ publishEvent: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../events/app-events.js', () => ({ appEvents: { emit: vi.fn() } }))

import { db } from '../db.js'
import { deleteWorker, getWorker, restoreWorker, listWorkers } from './worker.service.js'
import { purgeExpiredSoftDeletes, purgeService } from './purge.service.js'

const mockDb = db as any

function makeWorker(overrides = {}) {
  return {
    id: 'w1',
    name: 'Test Worker',
    categoryId: 'c1',
    curatorId: 'u1',
    isActive: true,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: { id: 'c1', name: 'Plumbing' },
    curator: { id: 'u1', firstName: 'Jane', lastName: 'Smith', avatar: null },
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

describe('deleteWorker — soft delete', () => {
  it('sets deletedAt instead of hard-deleting', async () => {
    mockDb.worker.update.mockResolvedValue(makeWorker({ deletedAt: new Date() }))
    await deleteWorker('w1')
    expect(mockDb.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1' }, data: { deletedAt: expect.any(Date) } })
    )
  })
})

describe('getWorker — excludes soft-deleted', () => {
  it('passes deletedAt: null to findUnique', async () => {
    mockDb.worker.findUnique.mockResolvedValue(makeWorker())
    await getWorker('w1')
    expect(mockDb.worker.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1', deletedAt: null } })
    )
  })

  it('throws 404 when worker is soft-deleted (findUnique returns null)', async () => {
    mockDb.worker.findUnique.mockResolvedValue(null)
    await expect(getWorker('w1')).rejects.toThrow(AppError)
  })
})

describe('listWorkers — excludes soft-deleted', () => {
  it('includes deletedAt: null in the where clause', async () => {
    mockDb.worker.findMany.mockResolvedValue([])
    mockDb.worker.count.mockResolvedValue(0)
    await listWorkers({})
    const call = mockDb.worker.findMany.mock.calls[0][0]
    expect(call.where).toMatchObject({ deletedAt: null })
  })
})

describe('restoreWorker', () => {
  it('clears deletedAt on a soft-deleted worker', async () => {
    const deleted = makeWorker({ deletedAt: new Date() })
    mockDb.worker.findUnique.mockResolvedValue(deleted)
    mockDb.worker.update.mockResolvedValue(makeWorker({ deletedAt: null }))
    await restoreWorker('w1')
    expect(mockDb.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'w1' }, data: { deletedAt: null } })
    )
  })

  it('throws 400 when worker is not deleted', async () => {
    mockDb.worker.findUnique.mockResolvedValue(makeWorker({ deletedAt: null }))
    await expect(restoreWorker('w1')).rejects.toThrow(AppError)
  })

  it('throws 404 when worker does not exist', async () => {
    mockDb.worker.findUnique.mockResolvedValue(null)
    await expect(restoreWorker('w1')).rejects.toThrow(AppError)
  })
})

describe('purgeExpiredSoftDeletes', () => {
  it('hard-deletes workers and users with deletedAt older than 90 days', async () => {
    mockDb.worker.deleteMany.mockResolvedValue({ count: 2 })
    mockDb.user.deleteMany.mockResolvedValue({ count: 1 })
    await purgeExpiredSoftDeletes()
    expect(mockDb.worker.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: { lte: expect.any(Date) } } })
    )
    expect(mockDb.user.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: { lte: expect.any(Date) } } })
    )
  })

  it('uses a cutoff of ~90 days ago', async () => {
    mockDb.worker.deleteMany.mockResolvedValue({ count: 0 })
    mockDb.user.deleteMany.mockResolvedValue({ count: 0 })
    const before = Date.now()
    await purgeExpiredSoftDeletes()
    const cutoff: Date = mockDb.worker.deleteMany.mock.calls[0][0].where.deletedAt.lte
    const diffDays = (before - cutoff.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeCloseTo(90, 0)
  })
})

describe('purgeService.deleteExpiredSessions', () => {
  it('deletes expired refresh tokens', async () => {
    mockDb.refreshToken.deleteMany.mockResolvedValue({ count: 3 })
    await purgeService.deleteExpiredSessions()
    expect(mockDb.refreshToken.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      })
    )
  })
})

describe('purgeService.deleteOldNotifications', () => {
  it('deletes notifications older than the specified days', async () => {
    mockDb.notification.deleteMany.mockResolvedValue({ count: 10 })
    await purgeService.deleteOldNotifications(7)
    const call = mockDb.notification.deleteMany.mock.calls[0][0]
    expect(call.where.createdAt.lte).toBeInstanceOf(Date)
  })
})
