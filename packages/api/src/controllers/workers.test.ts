/**
 * Unit tests for the workers controller (src/controllers/workers.ts).
 *
 * The controller is a thin HTTP layer: parse/validate `req`, delegate to
 * `worker.service.ts`, shape the response. These tests mock the service and
 * assert on request→service wiring and service-error→response translation.
 * Business-logic behavior (queries, filters, image handling, ownership of
 * data) is covered directly against the service in `worker.service.test.ts`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Other controller imports (search.service, stellar.service) transitively
// import the real db.ts; stub it so nothing in this file touches Prisma.
vi.mock('../db.js', () => ({ db: {} }))

vi.mock('../services/worker.service.js', () => ({
  listWorkersCursor: vi.fn(),
  listWorkersGeo: vi.fn(),
  listWorkers: vi.fn(),
  getWorkerWithPortfolio: vi.fn(),
  createWorkerWithMedia: vi.fn(),
  updateWorkerWithMedia: vi.fn(),
  deleteWorkerWithMedia: vi.fn(),
  toggleWorker: vi.fn(),
  listMyWorkers: vi.fn(),
}))

vi.mock('../resources/index.js', () => ({
  WorkerResource: vi.fn((w) => w),
}))

vi.mock('../serializers/index.js', () => ({
  workerSerializer: { serialize: vi.fn((w) => w) },
}))

vi.mock('../middleware/cache.js', () => ({
  invalidateCachePattern: vi.fn().mockResolvedValue(undefined),
}))

import * as workerService from '../services/worker.service.js'
import { AppError } from '../services/AppError.js'
import {
  listWorkers,
  showWorker,
  createWorker,
  updateWorker,
  deleteWorker,
  toggleActivation,
  listMyWorkers,
} from './workers.js'

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  res.send = vi.fn().mockReturnValue(res)
  return res
}

const worker = { id: 'w1', name: 'Alice', isActive: true, curatorId: 'c1' }

beforeEach(() => vi.clearAllMocks())

// ── listWorkers ───────────────────────────────────────────────────────────────

describe('listWorkers', () => {
  it('uses cursor mode when page/lat/lng are all absent', async () => {
    ;(workerService.listWorkersCursor as any).mockResolvedValue({ data: [worker], nextCursor: null })
    const req = { query: {} } as any
    const res = makeRes()
    await listWorkers(req, res)
    expect(workerService.listWorkersCursor).toHaveBeenCalled()
    expect(workerService.listWorkers).not.toHaveBeenCalled()
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', code: 200, data: [worker], nextCursor: null }),
    )
  })

  it('uses geo mode when lat/lng are provided', async () => {
    ;(workerService.listWorkersGeo as any).mockResolvedValue([worker])
    const req = { query: { lat: '10', lng: '20', radius: '5' } } as any
    const res = makeRes()
    await listWorkers(req, res)
    expect(workerService.listWorkersGeo).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 10, lng: 20, radiusKm: 5 }),
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', data: [worker] }))
  })

  it('returns 400 for invalid geo params', async () => {
    const req = { query: { lat: 'nope', lng: '20' } } as any
    const res = makeRes()
    await listWorkers(req, res)
    expect(res.status).toHaveBeenCalledWith(400)
    expect(workerService.listWorkersGeo).not.toHaveBeenCalled()
  })

  it('uses offset mode and passes filters when page is provided', async () => {
    ;(workerService.listWorkers as any).mockResolvedValue({ data: [worker], meta: { total: 1 } })
    const req = { query: { page: '2', limit: '5', category: 'plumber', search: 'ali' } } as any
    const res = makeRes()
    await listWorkers(req, res)
    expect(workerService.listWorkers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5, category: 'plumber', search: 'ali' }),
    )
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', code: 200 }))
  })
})

// ── showWorker ────────────────────────────────────────────────────────────────

describe('showWorker', () => {
  it('returns 200 when worker exists', async () => {
    ;(workerService.getWorkerWithPortfolio as any).mockResolvedValue(worker)
    const req = { params: { id: 'w1' } } as any
    const res = makeRes()
    await showWorker(req, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', data: worker }))
  })

  it('returns 404 when worker does not exist', async () => {
    ;(workerService.getWorkerWithPortfolio as any).mockResolvedValue(null)
    const req = { params: { id: 'missing' } } as any
    const res = makeRes()
    await showWorker(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', message: 'Not found' }))
  })
})

// ── createWorker ──────────────────────────────────────────────────────────────

describe('createWorker', () => {
  it('returns 201 on success and passes curatorId + file to the service', async () => {
    ;(workerService.createWorkerWithMedia as any).mockResolvedValue(worker)
    const file = { path: '/tmp/upload.png' }
    const req = { body: { name: 'Alice' }, user: { id: 'curator-99' }, file } as any
    const res = makeRes()
    await createWorker(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(workerService.createWorkerWithMedia).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Alice' }), 'curator-99', file,
    )
  })

  it('handles service errors', async () => {
    ;(workerService.createWorkerWithMedia as any).mockRejectedValue(new AppError('Conflict', 409))
    const req = { body: {}, user: { id: 'c1' } } as any
    const res = makeRes()
    await createWorker(req, res)
    expect(res.status).toHaveBeenCalledWith(409)
  })
})

// ── updateWorker ──────────────────────────────────────────────────────────────

describe('updateWorker', () => {
  it('returns 200 on success', async () => {
    ;(workerService.updateWorkerWithMedia as any).mockResolvedValue({ ...worker, name: 'Bob' })
    const req = { params: { id: 'w1' }, body: { name: 'Bob' }, user: { id: 'c1' } } as any
    const res = makeRes()
    await updateWorker(req, res)
    expect(workerService.updateWorkerWithMedia).toHaveBeenCalledWith('w1', { name: 'Bob' }, undefined, 'c1')
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
  })

  it('returns 404 when the service reports the worker is missing', async () => {
    ;(workerService.updateWorkerWithMedia as any).mockRejectedValue(new AppError('Not found', 404))
    const req = { params: { id: 'ghost' }, body: {}, user: { id: 'c1' } } as any
    const res = makeRes()
    await updateWorker(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

// ── deleteWorker ──────────────────────────────────────────────────────────────

describe('deleteWorker', () => {
  it('returns 204 on success', async () => {
    ;(workerService.deleteWorkerWithMedia as any).mockResolvedValue(undefined)
    const req = { params: { id: 'w1' } } as any
    const res = makeRes()
    await deleteWorker(req, res)
    expect(workerService.deleteWorkerWithMedia).toHaveBeenCalledWith('w1')
    expect(res.status).toHaveBeenCalledWith(204)
  })

  it('handles service errors', async () => {
    ;(workerService.deleteWorkerWithMedia as any).mockRejectedValue(new Error('DB down'))
    const req = { params: { id: 'w1' } } as any
    const res = makeRes()
    await deleteWorker(req, res)
    expect(res.status).toHaveBeenCalledWith(500)
  })
})

// ── toggleActivation ──────────────────────────────────────────────────────────

describe('toggleActivation', () => {
  it('returns 200 with the toggled worker', async () => {
    ;(workerService.toggleWorker as any).mockResolvedValue({ ...worker, isActive: false })
    const req = { params: { id: 'w1' } } as any
    const res = makeRes()
    await toggleActivation(req, res)
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
  })

  it('returns 404 when the worker does not exist', async () => {
    ;(workerService.toggleWorker as any).mockRejectedValue(new AppError('Not found', 404))
    const req = { params: { id: 'ghost' } } as any
    const res = makeRes()
    await toggleActivation(req, res)
    expect(res.status).toHaveBeenCalledWith(404)
  })
})

// ── listMyWorkers ─────────────────────────────────────────────────────────────

describe('listMyWorkers', () => {
  it('returns workers for the authenticated curator', async () => {
    ;(workerService.listMyWorkers as any).mockResolvedValue({ data: [worker], meta: { total: 1 } })
    const req = { query: { page: '1', limit: '10' }, user: { id: 'c1' } } as any
    const res = makeRes()
    await listMyWorkers(req, res)
    expect(workerService.listMyWorkers).toHaveBeenCalledWith('c1', 1, 10)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'success', meta: expect.objectContaining({ total: 1 }) }),
    )
  })

  it('uses default page/limit when not provided', async () => {
    ;(workerService.listMyWorkers as any).mockResolvedValue({ data: [], meta: { total: 0 } })
    const req = { query: {}, user: { id: 'c1' } } as any
    const res = makeRes()
    await listMyWorkers(req, res)
    expect(workerService.listMyWorkers).toHaveBeenCalledWith('c1', 1, 20)
  })
})
