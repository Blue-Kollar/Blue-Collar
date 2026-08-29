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
    review: {
      groupBy: vi.fn(),
    },
    searchAnalytics: {
      create: vi.fn(),
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

// WorkerCollection is a pure resource formatter — pass rows through unchanged
// so tests can assert on the raw query results.
vi.mock('../resources/index.js', () => ({
  WorkerCollection: (workers: any[]) => workers,
}))

vi.mock('../utils/imageProcessor.js', () => ({
  processImage: vi.fn(),
  deleteImages: vi.fn(),
}))

import { processImage, deleteImages } from '../utils/imageProcessor.js'

// Mock the logger
vi.mock('../utils/logger.js', () => ({
  createServiceLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
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
    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, deletedAt: null }),
        skip: 0,
        take: 20,
        include: { category: true, curator: true },
      })
    )
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

  it('uses full-text search when search term is provided', async () => {
    // The service delegates to $queryRawUnsafe for full-text search
    mockDb.$queryRawUnsafe = vi.fn().mockResolvedValue([])

    await workerService.listWorkers({ search: 'plumber' })

    // findMany should NOT be called — raw SQL is used instead
    expect(mockDb.worker.findMany).not.toHaveBeenCalled()
    expect(mockDb.$queryRawUnsafe).toHaveBeenCalled()
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

  it('combines category and location filters without search', async () => {
    const mockWorkers = [createMockWorker()]
    mockDb.worker.findMany.mockResolvedValue(mockWorkers)
    mockDb.worker.count.mockResolvedValue(1)

    await workerService.listWorkers({
      category: 'category-1',
      city: 'New York',
      page: 2,
      limit: 15,
    })

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          categoryId: 'category-1',
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
      where: { id: 'worker-1', deletedAt: null },
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
  it('soft-deletes a worker by setting deletedAt', async () => {
    mockDb.worker.update.mockResolvedValue({})

    await workerService.deleteWorker('worker-1')

    expect(mockDb.worker.update).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: { deletedAt: expect.any(Date) },
    })
  })

  it('propagates errors from the database', async () => {
    mockDb.worker.update.mockRejectedValue(new Error('Record not found'))

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

// ── listWorkersCursor ────────────────────────────────────────────────────────

describe('listWorkersCursor', () => {
  it('fetches one extra row to compute nextCursor and slices it off', async () => {
    const rows = [createMockWorker({ id: 'w1' }), createMockWorker({ id: 'w2' }), createMockWorker({ id: 'w3' })]
    mockDb.worker.findMany.mockResolvedValue(rows)

    const result = await workerService.listWorkersCursor({ limit: 2 })

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3, orderBy: { createdAt: 'desc' } }),
    )
    expect(result.data).toHaveLength(2)
    expect(result.nextCursor).toBe('w2')
  })

  it('returns a null nextCursor on the last page', async () => {
    mockDb.worker.findMany.mockResolvedValue([createMockWorker({ id: 'w1' })])

    const result = await workerService.listWorkersCursor({ limit: 2 })

    expect(result.nextCursor).toBeNull()
  })

  it('passes the cursor id and skip through to Prisma', async () => {
    mockDb.worker.findMany.mockResolvedValue([])

    await workerService.listWorkersCursor({ limit: 2, cursor: 'w1' })

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'w1' }, skip: 1 }),
    )
  })

  it('filters by rating via a review groupBy subquery', async () => {
    mockDb.worker.findMany.mockResolvedValue([])
    mockDb.review.groupBy.mockResolvedValue([{ workerId: 'w1' }, { workerId: 'w2' }])

    await workerService.listWorkersCursor({ limit: 2, minRating: 4 })

    expect(mockDb.review.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ having: { rating: { _avg: { gte: 4 } } } }),
    )
    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: ['w1', 'w2'] } }) }),
    )
  })
})

// ── listWorkersGeo ───────────────────────────────────────────────────────────

describe('listWorkersGeo', () => {
  it('filters by radius and sorts by distance ascending', async () => {
    mockDb.worker.findMany.mockResolvedValue([
      { id: 'far', location: { lat: 40.9, lng: -74.0 } },
      { id: 'near', location: { lat: 40.71, lng: -74.0 } },
    ])

    const result = await workerService.listWorkersGeo({ lat: 40.7, lng: -74.0, radiusKm: 50, page: 1, limit: 10 })

    expect(result.map((w: any) => w.id)).toEqual(['near', 'far'])
  })

  it('excludes workers outside the radius', async () => {
    mockDb.worker.findMany.mockResolvedValue([
      { id: 'in-range', location: { lat: 40.71, lng: -74.0 } },
      { id: 'out-of-range', location: { lat: 55, lng: -74.0 } },
    ])

    const result = await workerService.listWorkersGeo({ lat: 40.7, lng: -74.0, radiusKm: 50, page: 1, limit: 10 })

    expect(result.map((w: any) => w.id)).toEqual(['in-range'])
  })

  it('excludes workers with no location', async () => {
    mockDb.worker.findMany.mockResolvedValue([{ id: 'no-loc', location: null }])

    const result = await workerService.listWorkersGeo({ lat: 40.7, lng: -74.0, radiusKm: 50, page: 1, limit: 10 })

    expect(result).toHaveLength(0)
  })

  it('paginates the in-memory result set', async () => {
    mockDb.worker.findMany.mockResolvedValue([
      { id: 'w1', location: { lat: 40.70, lng: -74.0 } },
      { id: 'w2', location: { lat: 40.71, lng: -74.0 } },
      { id: 'w3', location: { lat: 40.72, lng: -74.0 } },
    ])

    const result = await workerService.listWorkersGeo({ lat: 40.7, lng: -74.0, radiusKm: 50, page: 2, limit: 1 })

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('w2')
  })
})

// ── getWorkerWithPortfolio ───────────────────────────────────────────────────

describe('getWorkerWithPortfolio', () => {
  it('returns the worker with its portfolio included', async () => {
    const withPortfolio = { ...createMockWorker(), portfolio: [{ id: 'p1', order: 0 }] }
    mockDb.worker.findUnique.mockResolvedValue(withPortfolio)

    const result = await workerService.getWorkerWithPortfolio('worker-1')

    expect(result).toEqual(withPortfolio)
    expect(mockDb.worker.findUnique).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      include: { category: true, portfolio: { orderBy: { order: 'asc' } } },
    })
  })

  it('returns null when the worker does not exist (no throw)', async () => {
    mockDb.worker.findUnique.mockResolvedValue(null)

    await expect(workerService.getWorkerWithPortfolio('nonexistent')).resolves.toBeNull()
  })
})

// ── listMyWorkers ────────────────────────────────────────────────────────────

describe('listMyWorkers', () => {
  it('paginates workers owned by the given curator', async () => {
    mockDb.worker.findMany.mockResolvedValue([createMockWorker()])
    mockDb.worker.count.mockResolvedValue(1)

    const result = await workerService.listMyWorkers('curator-1', 2, 10)

    expect(mockDb.worker.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { curatorId: 'curator-1' }, skip: 10, take: 10 }),
    )
    expect(result.meta).toEqual({ total: 1, page: 2, limit: 10, pages: 1 })
  })
})

// ── createWorkerWithMedia / updateWorkerWithMedia / deleteWorkerWithMedia ──────

describe('createWorkerWithMedia', () => {
  it('creates the worker without touching the image processor when no file is given', async () => {
    mockDb.worker.create.mockResolvedValue(createMockWorker())

    await workerService.createWorkerWithMedia({ name: 'Jane', categoryId: 'cat-1' }, 'curator-1')

    expect(processImage).not.toHaveBeenCalled()
    expect(mockDb.worker.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'Jane' }) }),
    )
  })

  it('processes the upload and merges the resulting image fields into the create payload', async () => {
    ;(processImage as any).mockResolvedValue({ thumb: 't.webp', medium: 'm.webp', full: 'f.webp' })
    mockDb.worker.create.mockResolvedValue(createMockWorker())

    await workerService.createWorkerWithMedia({ name: 'Jane', categoryId: 'cat-1' }, 'curator-1', { path: '/tmp/x.png' })

    expect(processImage).toHaveBeenCalledWith('/tmp/x.png')
    expect(mockDb.worker.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageThumb: 't.webp', imageMedium: 'm.webp', imageFull: 'f.webp', avatar: 'f.webp' }),
      }),
    )
  })
})

describe('updateWorkerWithMedia', () => {
  it('updates without touching images when no file is given', async () => {
    mockDb.worker.update.mockResolvedValue(createMockWorker())

    await workerService.updateWorkerWithMedia('worker-1', { name: 'New' }, undefined)

    expect(deleteImages).not.toHaveBeenCalled()
    expect(processImage).not.toHaveBeenCalled()
    expect(mockDb.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: 'New' }) }),
    )
  })

  it('deletes the old image variants and processes the new one when a file is uploaded', async () => {
    mockDb.worker.findUnique.mockResolvedValue({ imageFull: 'old-full.webp' })
    ;(processImage as any).mockResolvedValue({ thumb: 't.webp', medium: 'm.webp', full: 'f.webp' })
    mockDb.worker.update.mockResolvedValue(createMockWorker())

    await workerService.updateWorkerWithMedia('worker-1', {}, { path: '/tmp/x.png' })

    expect(deleteImages).toHaveBeenCalledWith('old-full.webp')
    expect(processImage).toHaveBeenCalledWith('/tmp/x.png')
    expect(mockDb.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageThumb: 't.webp', imageMedium: 'm.webp', imageFull: 'f.webp' }),
      }),
    )
  })

  it('does not delete images when the existing worker has none', async () => {
    mockDb.worker.findUnique.mockResolvedValue({ imageFull: null })
    ;(processImage as any).mockResolvedValue({ thumb: 't.webp', medium: 'm.webp', full: 'f.webp' })
    mockDb.worker.update.mockResolvedValue(createMockWorker())

    await workerService.updateWorkerWithMedia('worker-1', {}, { path: '/tmp/x.png' })

    expect(deleteImages).not.toHaveBeenCalled()
  })
})

describe('deleteWorkerWithMedia', () => {
  it('deletes existing image variants before soft-deleting the worker', async () => {
    mockDb.worker.findUnique.mockResolvedValue({ imageFull: 'full.webp' })
    mockDb.worker.update.mockResolvedValue({})

    await workerService.deleteWorkerWithMedia('worker-1')

    expect(deleteImages).toHaveBeenCalledWith('full.webp')
    expect(mockDb.worker.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'worker-1' }, data: { deletedAt: expect.any(Date) } }),
    )
  })

  it('skips image deletion when the worker has no image', async () => {
    mockDb.worker.findUnique.mockResolvedValue({ imageFull: null })
    mockDb.worker.update.mockResolvedValue({})

    await workerService.deleteWorkerWithMedia('worker-1')

    expect(deleteImages).not.toHaveBeenCalled()
  })
})

// ── trackSearchAnalytics ─────────────────────────────────────────────────────

describe('trackSearchAnalytics', () => {
  it('writes a search analytics record', async () => {
    mockDb.searchAnalytics.create.mockResolvedValue({})

    await workerService.trackSearchAnalytics('plumber', 5, true, '127.0.0.1')

    expect(mockDb.searchAnalytics.create).toHaveBeenCalledWith({
      data: { query: 'plumber', resultsCount: 5, hasFilters: true, ipAddress: '127.0.0.1' },
    })
  })

  it('silently swallows errors from the database', async () => {
    mockDb.searchAnalytics.create.mockRejectedValue(new Error('table missing'))

    await expect(
      workerService.trackSearchAnalytics('plumber', 0, false, '127.0.0.1'),
    ).resolves.toBeUndefined()
  })
})
