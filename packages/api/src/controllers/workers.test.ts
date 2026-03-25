import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db.js', () => ({
  db: {
    worker: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { db } from '../db.js'
import { updateWorker, deleteWorker, toggleActivation } from '../controllers/workers.js'

function makeRes() {
  const res: any = {
    statusCode: 200,
    body: {},
    status(code: number) { this.statusCode = code; return this },
    json(data: any) { this.body = data; return this },
    send() { return this },
  }
  return res
}

function makeReq(userId: string, role: string, workerId = 'worker-1'): any {
  return { params: { id: workerId }, body: { name: 'Updated' }, user: { id: userId, role } }
}

const ownedWorker = { id: 'worker-1', curatorId: 'curator-1', isActive: true }

beforeEach(() => vi.clearAllMocks())

// ── updateWorker ──────────────────────────────────────────────────────────────

describe('updateWorker', () => {
  it('returns 403 when curator does not own the worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    const res = makeRes()
    await updateWorker(makeReq('other-curator', 'curator'), res)
    expect(res.statusCode).toBe(403)
    expect(db.worker.update).not.toHaveBeenCalled()
  })

  it('updates when curator owns the worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    ;(db.worker.update as any).mockResolvedValue({ ...ownedWorker, name: 'Updated' })
    const res = makeRes()
    await updateWorker(makeReq('curator-1', 'curator'), res)
    expect(res.statusCode).toBe(200)
    expect(db.worker.update).toHaveBeenCalledOnce()
  })

  it('allows admin to update any worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    ;(db.worker.update as any).mockResolvedValue(ownedWorker)
    const res = makeRes()
    await updateWorker(makeReq('admin-1', 'admin'), res)
    expect(res.statusCode).toBe(200)
  })

  it('returns 404 when worker does not exist', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(null)
    const res = makeRes()
    await updateWorker(makeReq('curator-1', 'curator'), res)
    expect(res.statusCode).toBe(404)
  })
})

// ── deleteWorker ──────────────────────────────────────────────────────────────

describe('deleteWorker', () => {
  it('returns 403 when curator does not own the worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    const res = makeRes()
    await deleteWorker(makeReq('other-curator', 'curator'), res)
    expect(res.statusCode).toBe(403)
    expect(db.worker.delete).not.toHaveBeenCalled()
  })

  it('deletes when curator owns the worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    ;(db.worker.delete as any).mockResolvedValue(undefined)
    const res = makeRes()
    await deleteWorker(makeReq('curator-1', 'curator'), res)
    expect(res.statusCode).toBe(204)
    expect(db.worker.delete).toHaveBeenCalledOnce()
  })

  it('allows admin to delete any worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    ;(db.worker.delete as any).mockResolvedValue(undefined)
    const res = makeRes()
    await deleteWorker(makeReq('admin-1', 'admin'), res)
    expect(res.statusCode).toBe(204)
  })
})

// ── toggleActivation ──────────────────────────────────────────────────────────

describe('toggleActivation', () => {
  it('returns 403 when curator does not own the worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    const res = makeRes()
    await toggleActivation(makeReq('other-curator', 'curator'), res)
    expect(res.statusCode).toBe(403)
    expect(db.worker.update).not.toHaveBeenCalled()
  })

  it('toggles isActive when curator owns the worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    ;(db.worker.update as any).mockResolvedValue({ ...ownedWorker, isActive: false })
    const res = makeRes()
    await toggleActivation(makeReq('curator-1', 'curator'), res)
    expect(res.statusCode).toBe(200)
    expect((db.worker.update as any).mock.calls[0][0].data.isActive).toBe(false)
  })

  it('allows admin to toggle any worker', async () => {
    ;(db.worker.findUnique as any).mockResolvedValue(ownedWorker)
    ;(db.worker.update as any).mockResolvedValue({ ...ownedWorker, isActive: false })
    const res = makeRes()
    await toggleActivation(makeReq('admin-1', 'admin'), res)
    expect(res.statusCode).toBe(200)
  })
})
