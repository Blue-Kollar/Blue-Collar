import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock Prisma db ────────────────────────────────────────────────────────────
vi.mock('../db.js', () => ({
  db: {
    worker: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { db } from '../db.js'
import { AppError } from '../services/AppError.js'
import {
  createWorker,
  toggleWorker,
  listWorkers,
} from '../services/worker.service.js'

// ── Shared fixtures ───────────────────────────────────────────────────────────

const baseCategory = { id: 'cat-1', name: 'Plumbing', description: null, icon: null, createdAt: new Date(), updatedAt: new Date() }
const baseCurator  = { id: 'curator-1', firstName: 'Jane', lastName: 'Doe', avatar: null }

function makeWorker(overrides = {}) {
  return {
    id: 'worker-1',
    name: 'John Smith',
    bio: null,
    avatar: null,
    phone: '555-0100',
    email: null,
    walletAddress: null,
    isActive: true,
    isVerified: false,
    categoryId: 'cat-1',
    curatorId: 'curator-1',
    locationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    category: baseCategory,
    curator: baseCurator,
    ...overrides,
  }
}

beforeEach(() => vi.clearAllMocks())

// ── Edge case: register a worker whose ID already exists ──────────────────────

describe('createWorker – duplicate worker', () => {
  it('propagates a Prisma unique-constraint error when the worker already exists', async () => {
    const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    ;(db.worker.create as any).mockRejectedValue(prismaError)

    await expect(
      createWorker({ name: 'John Smith', categoryId: 'cat-1', phone: '555-0100' }, 'curator-1'),
    ).rejects.toThrow('Unique constraint failed')

    expect(db.worker.create).toHaveBeenCalledOnce()
  })

  it('does not silently swallow the error – caller receives the rejection', async () => {
    const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' })
    ;(db.worker.create as any).mockRejectedValue(prismaError)

    const result = createWorker({ name: 'John Smith', categoryId: 'cat-1', phone: '555-0100' }, 'curator-1')
    await expect(result).rejects.toBeDefined()
  })
})

// ── Edge case: toggle a worker that does not exist ────────────────────────────

describe('toggleWorker – non-existent worker', () => {
  it('throws AppError with 404 when worker is not found', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(null)

    await expect(toggleWorker('ghost-id')).rejects.toThrow(AppError)
    await expect(toggleWorker('ghost-id')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('does not call db.worker.update when worker is missing', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(null)

    await expect(toggleWorker('ghost-id')).rejects.toThrow()
    expect(db.worker.update).not.toHaveBeenCalled()
  })
})

// ── Edge case: listWorkers with 100+ workers ──────────────────────────────────

describe('listWorkers – large dataset (100+ workers)', () => {
  function makeWorkerRow(i: number) {
    return makeWorker({ id: `worker-${i}`, name: `Worker ${i}` })
  }

  it('returns all 120 workers when limit is set to 120', async () => {
    const workers = Array.from({ length: 120 }, (_, i) => makeWorkerRow(i))
    ;(db.worker.findMany as any).mockResolvedValue(workers)
    ;(db.worker.count as any).mockResolvedValue(120)

    const result = await listWorkers({ limit: 120, page: 1 })

    expect(result.data).toHaveLength(120)
    expect(result.meta.total).toBe(120)
    expect(result.meta.pages).toBe(1)
  })

  it('paginates correctly – page 2 of 100-worker dataset with limit 20', async () => {
    const page2Workers = Array.from({ length: 20 }, (_, i) => makeWorkerRow(20 + i))
    ;(db.worker.findMany as any).mockResolvedValue(page2Workers)
    ;(db.worker.count as any).mockResolvedValue(100)

    const result = await listWorkers({ limit: 20, page: 2 })

    expect(result.data).toHaveLength(20)
    expect(result.meta.total).toBe(100)
    expect(result.meta.page).toBe(2)
    expect(result.meta.pages).toBe(5)
    // Verify skip was calculated correctly
    expect((db.worker.findMany as any).mock.calls[0][0].skip).toBe(20)
  })

  it('returns correct meta when total exceeds one page', async () => {
    ;(db.worker.findMany as any).mockResolvedValue(Array.from({ length: 20 }, (_, i) => makeWorkerRow(i)))
    ;(db.worker.count as any).mockResolvedValue(150)

    const result = await listWorkers({ limit: 20, page: 1 })

    expect(result.meta.total).toBe(150)
    expect(result.meta.pages).toBe(8) // ceil(150/20)
  })

  it('does not truncate worker fields for large result sets', async () => {
    const workers = Array.from({ length: 50 }, (_, i) =>
      makeWorker({ id: `worker-${i}`, name: `Worker ${i}`, bio: `Bio for worker ${i}`, phone: `555-${String(i).padStart(4, '0')}` }),
    )
    ;(db.worker.findMany as any).mockResolvedValue(workers)
    ;(db.worker.count as any).mockResolvedValue(50)

    const result = await listWorkers({ limit: 50, page: 1 })

    result.data.forEach((w: any, i: number) => {
      expect(w.name).toBe(`Worker ${i}`)
      expect(w.bio).toBe(`Bio for worker ${i}`)
    })
  })
})

// ── Edge case: updatedAt is refreshed after each write (extend_ttl equivalent) ─

describe('updatedAt timestamp – refreshed after writes', () => {
  it('returns a fresh updatedAt after toggleWorker', async () => {
    const originalDate = new Date('2025-01-01T00:00:00Z')
    const updatedDate  = new Date('2026-03-27T12:00:00Z')

    ;(db.worker.findUnique as any).mockResolvedValue(makeWorker({ updatedAt: originalDate }))
    ;(db.worker.update as any).mockResolvedValue(makeWorker({ isActive: false, updatedAt: updatedDate }))

    const result = await toggleWorker('worker-1')

    expect(result.updatedAt).toEqual(updatedDate)
    expect(result.updatedAt).not.toEqual(originalDate)
  })

  it('db.worker.update is called exactly once per toggleWorker invocation', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(makeWorker())
    ;(db.worker.update as any).mockResolvedValue(makeWorker({ isActive: false }))

    await toggleWorker('worker-1')

    expect(db.worker.update).toHaveBeenCalledOnce()
  })
})

// ── Edge case: initialize re-initialization guard ─────────────────────────────

describe('createWorker – re-initialization guard', () => {
  it('calls db.worker.create only once per invocation (no double-init)', async () => {
    ;(db.worker.create as any).mockResolvedValue(makeWorker())

    await createWorker({ name: 'John Smith', categoryId: 'cat-1', phone: '555-0100' }, 'curator-1')

    expect(db.worker.create).toHaveBeenCalledOnce()
  })

  it('a second createWorker call with the same data triggers a second db.create (no idempotency guard)', async () => {
    ;(db.worker.create as any).mockResolvedValue(makeWorker())

    await createWorker({ name: 'John Smith', categoryId: 'cat-1', phone: '555-0100' }, 'curator-1')
    await createWorker({ name: 'John Smith', categoryId: 'cat-1', phone: '555-0100' }, 'curator-1')

    // Service has no idempotency guard – Prisma enforces uniqueness at DB level
    expect(db.worker.create).toHaveBeenCalledTimes(2)
  })

  it('throws when called with missing required fields (categoryId)', async () => {
    const validationError = new Error('Argument `categoryId` is missing')
    ;(db.worker.create as any).mockRejectedValue(validationError)

    await expect(
      createWorker({ name: 'John Smith' } as any, 'curator-1'),
    ).rejects.toThrow('Argument `categoryId` is missing')
  })
})
