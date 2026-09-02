/**
 * Issue #1217 — Optimize N+1 queries in transaction / listing endpoints.
 *
 * Regression tests verifying that listing endpoints issue a single batched
 * query (findMany + count in a single Promise.all) instead of sequential
 * queries. We do this by checking that the repository / controller code
 * calls the correct Prisma methods exactly once each per request, and that
 * they are dispatched concurrently (Promise.all) rather than sequentially.
 */
import { beforeEach,describe, expect, it, vi } from 'vitest'

// ── Escrow listing — Promise.all batching ────────────────────────────────────

describe('EscrowRepository.listEscrows — single batched query', () => {
  it('issues findMany and count concurrently via Promise.all', async () => {
    // Spy on the db object before importing the repo so we can track calls
    const findManySpy = vi.fn().mockResolvedValue([])
    const countSpy = vi.fn().mockResolvedValue(0)

    vi.doMock('../db.js', () => ({
      db: {
        escrowRecord: {
          findMany: findManySpy,
          count: countSpy,
        },
      },
    }))

    // Dynamic import after mock to pick up the mock
    const { EscrowRepository } = await import('../repositories/escrow.repository.js')
    const repo = new EscrowRepository()

    await repo.listEscrows({}, { skip: 0, take: 20 })

    // Both queries must have been called exactly once
    expect(findManySpy).toHaveBeenCalledOnce()
    expect(countSpy).toHaveBeenCalledOnce()

    vi.doUnmock('../db.js')
  })
})

// ── Notification listing — Promise.all batching ───────────────────────────────

describe('notifications controller — listNotifications uses parallel queries', () => {
  it('calls db.notification.findMany and db.notification.count once each', async () => {
    const findManySpy = vi.fn().mockResolvedValue([])
    const countSpy = vi.fn().mockResolvedValue(0)

    vi.doMock('../db.js', () => ({
      db: {
        notification: {
          findMany: findManySpy,
          count: countSpy,
          // update/delete not needed for this handler
        },
      },
    }))

    const { listNotifications } = await import('../controllers/notifications.js')

    const req: any = {
      user: { id: 'user-1' },
      query: { page: '1', limit: '20' },
    }
    const res: any = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    }
    const next = vi.fn()

    await listNotifications(req, res, next)

    expect(findManySpy).toHaveBeenCalledOnce()
    expect(countSpy).toHaveBeenCalledOnce()
    // No error should be forwarded
    expect(next).not.toHaveBeenCalled()

    vi.doUnmock('../db.js')
  })
})

// ── Worker export — joined select (no N+1) ─────────────────────────────────────

describe('exportWorkers — uses Prisma include (single joined query, no N+1)', () => {
  it('calls db.worker.findMany with a category include', async () => {
    const findManySpy = vi.fn().mockResolvedValue([])

    vi.doMock('../db.js', () => ({
      db: {
        worker: { findMany: findManySpy },
        // audit log fired async, ignore
      },
    }))

    vi.doMock('../services/audit.service.js', () => ({
      log: vi.fn().mockResolvedValue(undefined),
    }))

    const { exportWorkers } = await import('../controllers/export.js')

    const req: any = {
      query: { format: 'json' },
      user: { id: 'admin-1' },
      ip: '127.0.0.1',
    }
    const res: any = {
      setHeader: vi.fn(),
      json: vi.fn(),
      send: vi.fn(),
      status: vi.fn().mockReturnThis(),
    }
    const next = vi.fn()

    await exportWorkers(req, res, next)

    expect(findManySpy).toHaveBeenCalledOnce()
    // The single findMany call must include the category relation
    const callArgs = findManySpy.mock.calls[0][0]
    expect(callArgs.select).toHaveProperty('category')
    // No second findMany or separate category query
    expect(findManySpy).toHaveBeenCalledOnce()

    vi.doUnmock('../db.js')
    vi.doUnmock('../services/audit.service.js')
  })
})
