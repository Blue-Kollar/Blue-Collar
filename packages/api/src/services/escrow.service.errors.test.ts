/**
 * escrow.service.errors.test.ts — error-path coverage for EscrowService (#1597)
 *
 * Complements escrow.service.test.ts (create/activate). This file covers the
 * guard branches and disputes flow that the happy-path suite leaves out:
 *  - releaseEscrow / cancelEscrow: not found, wrong status, forbidden, lock period
 *  - getEscrow / listEscrows: visibility rules and pagination meta
 *  - fileEscrowDispute: not found, outsider, completed escrow, happy path
 *  - resolveEscrowDispute: not found, under_review vs resolved vs dismissed
 *  - resolveDispute (module-level): not found, non-admin, outcome mapping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEscrowService, resolveDispute } from './escrow.service.js'
import { AppError } from '../utils/app-error.js'

vi.mock('../db.js', () => ({
  db: {
    systemConfig: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    escrowRecord: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('./notification.service.js', () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../db.js'
import { dispatchNotification } from './notification.service.js'

const PAYER_ID = 'user-payer'
const PAYEE_ID = 'user-payee'
const OUTSIDER_ID = 'user-stranger'
const ADMIN_ID = 'admin-001'
const ESCROW_ID = 'escrow-1'

const PAST = new Date(Date.now() - 60_000)
const FUTURE = new Date(Date.now() + 60 * 60 * 1000)

function escrow(overrides: Record<string, unknown> = {}) {
  return {
    id: ESCROW_ID,
    payerId: PAYER_ID,
    payeeId: PAYEE_ID,
    amountXlm: 50,
    status: 'active',
    expiresAt: PAST,
    ...overrides,
  }
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    createEscrow: vi.fn(),
    findEscrow: vi.fn().mockResolvedValue(escrow()),
    findEscrowWithDisputes: vi.fn().mockResolvedValue(escrow({ disputes: [] })),
    updateEscrow: vi.fn().mockImplementation(async (id: string, data: object) => ({ id, ...data })),
    findManyEscrows: vi.fn().mockResolvedValue([]),
    listEscrows: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    createDisputeAndMarkEscrow: vi.fn().mockResolvedValue({ id: 'dsp-1' }),
    findDispute: vi.fn().mockResolvedValue({ id: 'dsp-1', escrowId: ESCROW_ID, escrow: escrow() }),
    updateDispute: vi.fn().mockImplementation(async (id: string, data: object) => ({ id, ...data })),
    createAuditLog: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

// The global setup resets every mock after each test, so implementations
// declared in vi.mock factories must be restored here.
beforeEach(() => {
  vi.mocked(db.systemConfig.findUnique).mockResolvedValue(null)
  vi.mocked(dispatchNotification).mockResolvedValue(undefined)
})

// ─────────────────────────────────────────────────────────────────────────────
// releaseEscrow
// ─────────────────────────────────────────────────────────────────────────────

describe('EscrowService.releaseEscrow', () => {
  it('throws 404 when escrow does not exist', async () => {
    const repo = makeRepo({ findEscrow: vi.fn().mockResolvedValue(null) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.releaseEscrow('missing', PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 404 })
    expect(repo.updateEscrow).not.toHaveBeenCalled()
  })

  it('throws 400 when escrow is not active', async () => {
    const repo = makeRepo({ findEscrow: vi.fn().mockResolvedValue(escrow({ status: 'pending' })) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.releaseEscrow(ESCROW_ID, PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 403 when a non-admin non-payer tries to release', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.releaseEscrow(ESCROW_ID, PAYEE_ID, 'user')).rejects.toMatchObject({ statusCode: 403 })
    expect(repo.updateEscrow).not.toHaveBeenCalled()
  })

  it('marks the escrow released and stamps releasedAt', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    const result = await svc.releaseEscrow(ESCROW_ID, PAYER_ID, 'user')

    expect(repo.updateEscrow).toHaveBeenCalledWith(
      ESCROW_ID,
      expect.objectContaining({ status: 'released', releasedAt: expect.any(Date) }),
    )
    expect(result).toMatchObject({ status: 'released' })
  })

  it('lets an admin release an escrow they do not own', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.releaseEscrow(ESCROW_ID, ADMIN_ID, 'admin')).resolves.toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// cancelEscrow
// ─────────────────────────────────────────────────────────────────────────────

describe('EscrowService.cancelEscrow', () => {
  it('throws 404 when escrow does not exist', async () => {
    const repo = makeRepo({ findEscrow: vi.fn().mockResolvedValue(null) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.cancelEscrow('missing', PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when escrow is already released', async () => {
    const repo = makeRepo({ findEscrow: vi.fn().mockResolvedValue(escrow({ status: 'released' })) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.cancelEscrow(ESCROW_ID, PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 403 when a non-admin non-payer tries to cancel', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.cancelEscrow(ESCROW_ID, OUTSIDER_ID, 'user')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('refuses a non-admin cancel while the escrow is still inside its lock period', async () => {
    const repo = makeRepo({
      findEscrow: vi.fn().mockResolvedValue(escrow({ status: 'pending', expiresAt: FUTURE })),
    })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.cancelEscrow(ESCROW_ID, PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 400 })
    expect(repo.updateEscrow).not.toHaveBeenCalled()
  })

  it('lets an admin cancel inside the lock period', async () => {
    const repo = makeRepo({
      findEscrow: vi.fn().mockResolvedValue(escrow({ status: 'pending', expiresAt: FUTURE })),
    })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await svc.cancelEscrow(ESCROW_ID, ADMIN_ID, 'admin')

    expect(repo.updateEscrow).toHaveBeenCalledWith(
      ESCROW_ID,
      expect.objectContaining({ status: 'cancelled', cancelledAt: expect.any(Date) }),
    )
  })

  it('lets the payer cancel once the lock period has expired', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await svc.cancelEscrow(ESCROW_ID, PAYER_ID, 'user')

    expect(repo.updateEscrow).toHaveBeenCalledWith(ESCROW_ID, expect.objectContaining({ status: 'cancelled' }))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getEscrow / listEscrows
// ─────────────────────────────────────────────────────────────────────────────

describe('EscrowService.getEscrow', () => {
  it('throws 404 when escrow does not exist', async () => {
    const repo = makeRepo({ findEscrowWithDisputes: vi.fn().mockResolvedValue(null) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.getEscrow('missing', PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 for a user who is neither payer nor payee', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.getEscrow(ESCROW_ID, OUTSIDER_ID, 'user')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('returns the escrow to the payee and to admins', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.getEscrow(ESCROW_ID, PAYEE_ID, 'user')).resolves.toMatchObject({ id: ESCROW_ID })
    await expect(svc.getEscrow(ESCROW_ID, ADMIN_ID, 'admin')).resolves.toMatchObject({ id: ESCROW_ID })
  })
})

describe('EscrowService.listEscrows', () => {
  it('scopes non-admin callers to escrows they are party to', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await svc.listEscrows(PAYER_ID, 'user', 2, 10)

    expect(repo.listEscrows).toHaveBeenCalledWith(
      { OR: [{ payerId: PAYER_ID }, { payeeId: PAYER_ID }] },
      { skip: 10, take: 10 },
    )
  })

  it('does not filter for admins and reports pagination meta', async () => {
    const repo = makeRepo({
      listEscrows: vi.fn().mockResolvedValue({ data: [escrow()], total: 45 }),
    })
    const svc = createEscrowService({ escrowRepository: repo as any })

    const result = await svc.listEscrows(ADMIN_ID, 'admin', 3, 20)

    expect(repo.listEscrows).toHaveBeenCalledWith({}, { skip: 40, take: 20 })
    expect(result.meta).toEqual({ total: 45, page: 3, limit: 20, pages: 3 })
    expect(result.data).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// fileEscrowDispute / resolveEscrowDispute
// ─────────────────────────────────────────────────────────────────────────────

describe('EscrowService.fileEscrowDispute', () => {
  it('throws 404 when escrow does not exist', async () => {
    const repo = makeRepo({ findEscrow: vi.fn().mockResolvedValue(null) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.fileEscrowDispute('missing', PAYER_ID, 'late')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when the filer is not a party to the escrow', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.fileEscrowDispute(ESCROW_ID, OUTSIDER_ID, 'nope')).rejects.toMatchObject({ statusCode: 403 })
    expect(repo.createDisputeAndMarkEscrow).not.toHaveBeenCalled()
  })

  it.each(['released', 'cancelled'])('refuses to dispute a %s escrow', async (status) => {
    const repo = makeRepo({ findEscrow: vi.fn().mockResolvedValue(escrow({ status })) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.fileEscrowDispute(ESCROW_ID, PAYER_ID, 'late')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('creates the dispute and notifies the other party', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    const result = await svc.fileEscrowDispute(ESCROW_ID, PAYER_ID, 'Work not done', 'ipfs://evidence')

    expect(repo.createDisputeAndMarkEscrow).toHaveBeenCalledWith(
      ESCROW_ID,
      expect.objectContaining({ escrowId: ESCROW_ID, filedById: PAYER_ID, reason: 'Work not done', evidence: 'ipfs://evidence' }),
    )
    expect(dispatchNotification).toHaveBeenCalledWith(expect.objectContaining({ userId: PAYEE_ID }))
    expect(result).toEqual({ id: 'dsp-1' })
  })
})

describe('EscrowService.resolveEscrowDispute', () => {
  it('throws 404 when the dispute does not exist', async () => {
    const repo = makeRepo({ findDispute: vi.fn().mockResolvedValue(null) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.resolveEscrowDispute('missing', ADMIN_ID, 'resolved')).rejects.toMatchObject({ statusCode: 404 })
    expect(repo.updateDispute).not.toHaveBeenCalled()
  })

  it('keeps the escrow untouched while a dispute is under review', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await svc.resolveEscrowDispute('dsp-1', ADMIN_ID, 'under_review')

    expect(repo.updateDispute).toHaveBeenCalledWith('dsp-1', expect.objectContaining({ status: 'under_review', resolvedAt: undefined }))
    expect(repo.updateEscrow).not.toHaveBeenCalled()
    expect(dispatchNotification).not.toHaveBeenCalled()
  })

  it('releases the escrow when the dispute is resolved in the payee favour', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await svc.resolveEscrowDispute('dsp-1', ADMIN_ID, 'resolved', 'Work verified')

    expect(repo.updateEscrow).toHaveBeenCalledWith(ESCROW_ID, expect.objectContaining({ status: 'released' }))
    expect(repo.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ADMIN_ID, action: 'escrow.dispute.resolved', resourceId: 'dsp-1' }),
    )
  })

  it('cancels the escrow when the dispute is dismissed', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await svc.resolveEscrowDispute('dsp-1', ADMIN_ID, 'dismissed')

    expect(repo.updateEscrow).toHaveBeenCalledWith(ESCROW_ID, expect.objectContaining({ status: 'cancelled' }))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveDispute (module-level, DB-backed)
// ─────────────────────────────────────────────────────────────────────────────

describe('resolveDispute', () => {
  it('throws 404 when the escrow record is missing', async () => {
    vi.mocked(db.escrowRecord.findUnique).mockResolvedValueOnce(null)

    await expect(resolveDispute('missing', 'release', ADMIN_ID, 'admin')).rejects.toMatchObject({ statusCode: 404 })
    expect(db.escrowRecord.update).not.toHaveBeenCalled()
  })

  it('throws 403 for a non-admin caller', async () => {
    vi.mocked(db.escrowRecord.findUnique).mockResolvedValueOnce(escrow() as any)

    await expect(resolveDispute(ESCROW_ID, 'release', PAYER_ID, 'user')).rejects.toBeInstanceOf(AppError)
    expect(db.escrowRecord.update).not.toHaveBeenCalled()
  })

  it('maps the release outcome to released and stamps releasedAt', async () => {
    vi.mocked(db.escrowRecord.findUnique).mockResolvedValueOnce(escrow() as any)
    vi.mocked(db.escrowRecord.update).mockResolvedValueOnce({ id: ESCROW_ID, status: 'released' } as any)

    await resolveDispute(ESCROW_ID, 'release', ADMIN_ID, 'admin')

    expect(db.escrowRecord.update).toHaveBeenCalledWith({
      where: { id: ESCROW_ID },
      data: expect.objectContaining({ status: 'released', releasedAt: expect.any(Date) }),
    })
  })

  it('maps the cancel outcome to cancelled and stamps cancelledAt', async () => {
    vi.mocked(db.escrowRecord.findUnique).mockResolvedValueOnce(escrow() as any)
    vi.mocked(db.escrowRecord.update).mockResolvedValueOnce({ id: ESCROW_ID, status: 'cancelled' } as any)

    await resolveDispute(ESCROW_ID, 'cancel', ADMIN_ID, 'admin')

    expect(db.escrowRecord.update).toHaveBeenCalledWith({
      where: { id: ESCROW_ID },
      data: expect.objectContaining({ status: 'cancelled', cancelledAt: expect.any(Date) }),
    })
  })
})
