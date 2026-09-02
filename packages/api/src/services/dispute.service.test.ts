/**
 * dispute.service.test.ts — unit tests for DisputeService (#1259)
 *
 * Coverage for:
 *  - fileDispute: worker not found, happy path with and without evidence
 *  - listDisputes: admin sees all, regular user sees own only
 *  - getDispute: not found, forbidden, happy path
 *  - resolveDispute: not found, already resolved, happy path
 */

import { describe, expect, it, vi } from 'vitest'

import { AppError } from '../utils/AppError.js'
import { createDisputeService } from './dispute.service.js'

// ── Mock repository ───────────────────────────────────────────────────────────

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    findWorkerById: vi.fn().mockResolvedValue({ id: 'worker-1', name: 'Jane Doe' }),
    createDispute: vi.fn().mockResolvedValue({ id: 'dispute-1', workerId: 'worker-1', filedById: 'user-1', reason: 'fraud', status: 'open' }),
    findManyWithRelations: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findWithRelations: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    updateDispute: vi.fn().mockResolvedValue({ id: 'dispute-1', status: 'resolved' }),
    ...overrides,
  }
}

const ADMIN_ID = 'admin-001'
const USER_ID = 'user-001'
const OTHER_USER_ID = 'user-999'
const WORKER_ID = 'worker-001'

// ─────────────────────────────────────────────────────────────────────────────
// fileDispute
// ─────────────────────────────────────────────────────────────────────────────

describe('DisputeService.fileDispute', () => {
  it('throws 404 when the worker does not exist', async () => {
    const repo = makeRepo({ findWorkerById: vi.fn().mockResolvedValue(null) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.fileDispute(WORKER_ID, USER_ID, 'fraud')).rejects.toThrow(AppError)
    await expect(svc.fileDispute(WORKER_ID, USER_ID, 'fraud')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('creates a dispute without evidence', async () => {
    const repo = makeRepo()
    const svc = createDisputeService({ disputeRepository: repo as any })

    const result = await svc.fileDispute(WORKER_ID, USER_ID, 'no-show')

    expect(repo.createDispute).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: WORKER_ID, filedById: USER_ID, reason: 'no-show' }),
    )
    expect(result.id).toBe('dispute-1')
  })

  it('creates a dispute with evidence', async () => {
    const repo = makeRepo()
    const svc = createDisputeService({ disputeRepository: repo as any })

    await svc.fileDispute(WORKER_ID, USER_ID, 'overcharge', 'https://example.com/screenshot.png')

    expect(repo.createDispute).toHaveBeenCalledWith(
      expect.objectContaining({ evidence: 'https://example.com/screenshot.png' }),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// listDisputes
// ─────────────────────────────────────────────────────────────────────────────

describe('DisputeService.listDisputes', () => {
  it('passes empty where clause for admin (sees all)', async () => {
    const repo = makeRepo({ findManyWithRelations: vi.fn().mockResolvedValue({ data: [], total: 0 }) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await svc.listDisputes(ADMIN_ID, 'admin', 1, 10)

    const call = repo.findManyWithRelations.mock.calls[0]
    expect(call[0]).toEqual({})
  })

  it('scopes the query to the calling user when role is not admin', async () => {
    const repo = makeRepo({ findManyWithRelations: vi.fn().mockResolvedValue({ data: [], total: 0 }) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await svc.listDisputes(USER_ID, 'user', 1, 10)

    const call = repo.findManyWithRelations.mock.calls[0]
    expect(call[0]).toEqual({ filedById: USER_ID })
  })

  it('calculates pagination meta correctly', async () => {
    const repo = makeRepo({ findManyWithRelations: vi.fn().mockResolvedValue({ data: [], total: 25 }) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    const result = await svc.listDisputes(ADMIN_ID, 'admin', 2, 10)

    expect(result.meta.pages).toBe(3)
    expect(result.meta.total).toBe(25)
    expect(result.meta.page).toBe(2)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getDispute
// ─────────────────────────────────────────────────────────────────────────────

describe('DisputeService.getDispute', () => {
  it('throws 404 when dispute does not exist', async () => {
    const repo = makeRepo({ findWithRelations: vi.fn().mockResolvedValue(null) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.getDispute('no-exist', ADMIN_ID, 'admin')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when a non-admin user tries to access someone else\'s dispute', async () => {
    const dispute = { id: 'dispute-1', filedById: OTHER_USER_ID }
    const repo = makeRepo({ findWithRelations: vi.fn().mockResolvedValue(dispute) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.getDispute('dispute-1', USER_ID, 'user')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('admin can access any dispute', async () => {
    const dispute = { id: 'dispute-1', filedById: USER_ID }
    const repo = makeRepo({ findWithRelations: vi.fn().mockResolvedValue(dispute) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.getDispute('dispute-1', ADMIN_ID, 'admin')).resolves.toEqual(dispute)
  })

  it('user can access their own dispute', async () => {
    const dispute = { id: 'dispute-1', filedById: USER_ID }
    const repo = makeRepo({ findWithRelations: vi.fn().mockResolvedValue(dispute) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.getDispute('dispute-1', USER_ID, 'user')).resolves.toEqual(dispute)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveDispute
// ─────────────────────────────────────────────────────────────────────────────

describe('DisputeService.resolveDispute', () => {
  it('throws 404 when dispute does not exist', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue(null) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.resolveDispute('no-exist', ADMIN_ID, 'resolved')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 409 when dispute is already resolved', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ id: 'dispute-1', status: 'resolved' }) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.resolveDispute('dispute-1', ADMIN_ID, 'resolved')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('throws 409 when dispute is already dismissed', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ id: 'dispute-1', status: 'dismissed' }) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await expect(svc.resolveDispute('dispute-1', ADMIN_ID, 'dismissed')).rejects.toMatchObject({ statusCode: 409 })
  })

  it('updates dispute with resolved status and resolution note', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ id: 'dispute-1', status: 'open' }) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    const result = await svc.resolveDispute('dispute-1', ADMIN_ID, 'resolved', 'Fraud confirmed — account banned')

    expect(repo.updateDispute).toHaveBeenCalledWith(
      'dispute-1',
      expect.objectContaining({ status: 'resolved', resolvedById: ADMIN_ID }),
    )
    expect(result.status).toBe('resolved')
  })

  it('can transition to under_review status', async () => {
    const repo = makeRepo({ findById: vi.fn().mockResolvedValue({ id: 'dispute-1', status: 'open' }) })
    const svc = createDisputeService({ disputeRepository: repo as any })

    await svc.resolveDispute('dispute-1', ADMIN_ID, 'under_review')

    expect(repo.updateDispute).toHaveBeenCalledWith(
      'dispute-1',
      expect.objectContaining({ status: 'under_review' }),
    )
  })
})
