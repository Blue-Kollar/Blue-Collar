import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AppError } from './AppError.js'
import * as workerService from './worker.service.js'

// Mock the database
vi.mock('../db.js', () => ({
  db: {
    worker: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { db } from '../db.js'

// Mock the worker model
vi.mock('../models/worker.model.js', () => ({
  formatWorker: (worker: any) => ({
    ...worker,
    formatted: true,
  }),
}))

const mockDb = db as any

// Helper to create mock worker data
function createMockWorker(overrides = {}) {
  return {
    id: 'worker-1',
    name: 'John Doe',
    categoryId: 'category-1',
    curatorId: 'curator-1',
    phone: '555-1234',
    email: 'john@example.com',
    bio: 'Experienced plumber',
    avatar: 'https://example.com/avatar.jpg',
    walletAddress: '0x123abc',
    locationId: 'location-1',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    category: { id: 'category-1', name: 'Plumbing' },
    curator: {
      id: 'curator-1',
      firstName: 'Jane',
      lastName: 'Smith',
      avatar: 'https://example.com/curator.jpg',
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── listWorkers ──────────────────────────────────────────────────────────────

describe('listWorkers', () => {
  it('returns paginated list of active workers with default pagination', async () => {
    const mockWorkers = [createMockWorker(), createMockWorker({ id: 'worker-2' })]
    mockDb.worker.findMany.mockResolvedValue(mockWorkers)
    mockDb.worker.count.mockResolvedValue(2)

    const result = await workerService.listWorkers({})

    expect(result.data).toHaveLength(2)
    expect(result.meta).toEqual({
      total: 2,
      page: 1,
      limit: 20,
      pages: 1,
    })
    expect(mockDb.worker.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      skip: 0,
      take: 20,
      include: { category: true, curator: true },
    })
  })

  it('filters by category', async () => {
    const mockWorkers = [createMockWorker()]
    mockDb.worker.findMany.mockResolvedValue(mockWorkers)
    mockDb.worker.count.mockResolvedValue(1)

    await workerService.listWorkers({ category: 'category-1' })

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          categoryId: 'category-1',
        }),
      })
    )
  })

  it('filters by search term in name and bio', async () => {
    const mockWorkers = [createMockWorker()]
    mockDb.worker.findMany.mockResolvedValue(mockWorkers)
    mockDb.worker.count.mockResolvedValue(1)

    await workerService.listWorkers({ search: 'plumber' })

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          OR: [
            { name: { contains: 'plumber', mode: 'insensitive' } },
            { bio: { contains: 'plumber', mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  it('filters by location (city, state, country)', async () => {
    const mockWorkers = [createMockWorker()]
    mockDb.worker.findMany.mockResolvedValue(mockWorkers)
    mockDb.worker.count.mockResolvedValue(1)

    await workerService.listWorkers({ city: 'New York', state: 'NY', country: 'USA' })

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          location: {
            city: { contains: 'New York', mode: 'insensitive' },
            state: { contains: 'NY', mode: 'insensitive' },
            country: { contains: 'USA', mode: 'insensitive' },
          },
        }),
      })
    )
  })

  it('handles pagination correctly', async () => {
    const mockWorkers = [createMockWorker()]
    mockDb.worker.findMany.mockResolvedValue(mockWorkers)
    mockDb.worker.count.mockResolvedValue(50)

    const result = await workerService.listWorkers({ page: 2, limit: 10 })

    expect(result.meta).toEqual({
      total: 50,
      page: 2,
      limit: 10,
      pages: 5,
    })
    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
      })
    )
  })

  it('returns empty list when no workers found', async () => {
    mockDb.worker.findMany.mockResolvedValue([])
    mockDb.worker.count.mockResolvedValue(0)

    const result = await workerService.listWorkers({})

    expect(result.data).toHaveLength(0)
    expect(result.meta.total).toBe(0)
  })

  it('combines multiple filters', async () => {
    const mockWorkers = [createMockWorker()]
    mockDb.worker.findMany.mockResolvedValue(mockWorkers)
    mockDb.worker.count.mockResolvedValue(1)

    await workerService.listWorkers({
      category: 'category-1',
      search: 'plumber',
      city: 'New York',
      page: 2,
      limit: 15,
    })

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          categoryId: 'category-1',
          OR: expect.any(Array),
          location: expect.any(Object),
        }),
        skip: 15,
        take: 15,
      })
    )
  })
})

// ── getWorker ────────────────────────────────────────────────────────────────

describe('getWorker', () => {
  it('returns a worker by id', async () => {
    const mockWorker = createMockWorker()
    mockDb.worker.findUnique.mockResolvedValue(mockWorker)

    const result = await workerService.getWorker('worker-1')

    expect(result).toEqual(expect.objectContaining({ formatted: true }))
    expect(mockDb.worker.findUnique).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      include: { category: true, curator: true },
    })
  })

  it('throws AppError with 404 when worker not found', async () => {
    mockDb.worker.findUnique.mockResolvedValue(null)

    await expect(workerService.getWorker('nonexistent')).rejects.toThrow(AppError)
    await expect(workerService.getWorker('nonexistent')).rejects.toMatchObject({
      message: 'Not found',
      statusCode: 404,
    })
  })
})

// ── createWorker ─────────────────────────────────────────────────────────────

describe('createWorker', () => {
  it('creates a new worker with provided data', async () => {
    const mockWorker = createMockWorker()
    mockDb.worker.create.mockResolvedValue(mockWorker)

    const createData = {
      name: 'John Doe',
      categoryId: 'category-1',
      phone: '555-1234',
      email: 'john@example.com',
      bio: 'Experienced plumber',
    }

    const result = await workerService.createWorker(createData, 'curator-1')

    expect(result).toEqual(expect.objectContaining({ formatted: true }))
    expect(mockDb.worker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...createData,
        curatorId: 'curator-1',
      }),
      include: { category: true, curator: true },
    })
  })

  it('creates a worker with minimal required fields', async () => {
    const mockWorker = createMockWorker({ phone: undefined, email: undefined, bio: undefined })
    mockDb.worker.create.mockResolvedValue(mockWorker)

    const createData = {
      name: 'John Doe',
      categoryId: 'category-1',
    }

    await workerService.createWorker(createData, 'curator-1')

    expect(mockDb.worker.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'John Doe',
        categoryId: 'category-1',
        curatorId: 'curator-1',
      }),
      include: { category: true, curator: true },
    })
  })

  it('associates the worker with the curator', async () => {
    const mockWorker = createMockWorker({ curatorId: 'curator-2' })
    mockDb.worker.create.mockResolvedValue(mockWorker)

    const createData = { name: 'Jane Doe', categoryId: 'category-2' }

    await workerService.createWorker(createData, 'curator-2')

    expect(mockDb.worker.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          curatorId: 'curator-2',
        }),
      })
    )
  })
})

// ── updateWorker ─────────────────────────────────────────────────────────────

describe('updateWorker', () => {
  it('updates a worker with provided data', async () => {
    const updatedWorker = createMockWorker({ name: 'Jane Doe' })
    mockDb.worker.update.mockResolvedValue(updatedWorker)

    const updateData = { name: 'Jane Doe' }

    const result = await workerService.updateWorker('worker-1', updateData)

    expect(result).toEqual(expect.objectContaining({ formatted: true }))
    expect(mockDb.worker.update).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: updateData,
      include: { category: true, curator: true },
    })
  })

  it('updates multiple fields at once', async () => {
    const updatedWorker = createMockWorker({
      name: 'Jane Doe',
      bio: 'Senior plumber',
      phone: '555-5678',
    })
    mockDb.worker.update.mockResolvedValue(updatedWorker)

    const updateData = {
      name: 'Jane Doe',
      bio: 'Senior plumber',
      phone: '555-5678',
    }

    await workerService.updateWorker('worker-1', updateData)

    expect(mockDb.worker.update).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: updateData,
      include: { category: true, curator: true },
    })
  })

  it('updates partial fields', async () => {
    const updatedWorker = createMockWorker({ bio: 'Updated bio' })
    mockDb.worker.update.mockResolvedValue(updatedWorker)

    const updateData = { bio: 'Updated bio' }

    await workerService.updateWorker('worker-1', updateData)

    expect(mockDb.worker.update).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: updateData,
      include: { category: true, curator: true },
    })
  })
})

// ── deleteWorker ─────────────────────────────────────────────────────────────

describe('deleteWorker', () => {
  it('deletes a worker by id', async () => {
    mockDb.worker.delete.mockResolvedValue({})

    await workerService.deleteWorker('worker-1')

    expect(mockDb.worker.delete).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
    })
  })

  it('handles deletion of non-existent worker gracefully', async () => {
    mockDb.worker.delete.mockRejectedValue(new Error('Record not found'))

    await expect(workerService.deleteWorker('nonexistent')).rejects.toThrow()
  })
})

// ── toggleWorker ─────────────────────────────────────────────────────────────

describe('toggleWorker', () => {
  it('toggles isActive from true to false', async () => {
    const activeWorker = createMockWorker({ isActive: true })
    const inactiveWorker = createMockWorker({ isActive: false })

    mockDb.worker.findUnique.mockResolvedValue(activeWorker)
    mockDb.worker.update.mockResolvedValue(inactiveWorker)

    const result = await workerService.toggleWorker('worker-1')

    expect(result).toEqual(expect.objectContaining({ formatted: true }))
    expect(mockDb.worker.update).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: { isActive: false },
      include: { category: true, curator: true },
    })
  })

  it('toggles isActive from false to true', async () => {
    const inactiveWorker = createMockWorker({ isActive: false })
    const activeWorker = createMockWorker({ isActive: true })

    mockDb.worker.findUnique.mockResolvedValue(inactiveWorker)
    mockDb.worker.update.mockResolvedValue(activeWorker)

    await workerService.toggleWorker('worker-1')

    expect(mockDb.worker.update).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: { isActive: true },
      include: { category: true, curator: true },
    })
  })

  it('throws AppError with 404 when worker not found', async () => {
    mockDb.worker.findUnique.mockResolvedValue(null)

    await expect(workerService.toggleWorker('nonexistent')).rejects.toThrow(AppError)
    await expect(workerService.toggleWorker('nonexistent')).rejects.toMatchObject({
      message: 'Not found',
      statusCode: 404,
    })
  })

  it('does not call update if worker not found', async () => {
    mockDb.worker.findUnique.mockResolvedValue(null)

    try {
      await workerService.toggleWorker('nonexistent')
    } catch {
      // Expected to throw
    }

    expect(mockDb.worker.update).not.toHaveBeenCalled()
  })
})
