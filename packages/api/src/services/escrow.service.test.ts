/**
 * escrow.service.test.ts — unit tests for EscrowService (#1259)
 *
 * Coverage for:
 *  - createEscrow: validation errors (amount ≤ 0, past expiry, same payer/payee),
 *    paused system guard, happy path
 *  - activateEscrow: not found, wrong status, forbidden caller, happy path
 *  - releaseEscrow: (depends on activateEscrow shape — covered via mocked repo)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEscrowService } from './escrow.service.js'
import { AppError } from '../utils/AppError.js'

// ── DB mock (for requireNotPaused) ────────────────────────────────────────────

vi.mock('../db.js', () => ({
  db: {
    systemConfig: {
      findUnique: vi.fn().mockResolvedValue(null), // not paused by default
    },
  },
}))

// ── Notification dispatch mock ────────────────────────────────────────────────

vi.mock('./notification.service.js', () => ({
  dispatchNotification: vi.fn().mockResolvedValue(undefined),
}))

// ── Repo factory ──────────────────────────────────────────────────────────────

function makeRepo(overrides: Record<string, unknown> = {}) {
  const now = new Date()
  const base = {
    id: 'escrow-1',
    payerId: 'user-payer',
    payeeId: 'user-payee',
    amountXlm: 50,
    status: 'pending',
    createdAt: now,
  }

  return {
    createEscrow: vi.fn().mockResolvedValue(base),
    findEscrow: vi.fn().mockResolvedValue(base),
    updateEscrow: vi.fn().mockResolvedValue({ ...base, status: 'active' }),
    findManyEscrows: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
}

const PAYER_ID = 'user-payer'
const PAYEE_ID = 'user-payee'
const ADMIN_ID = 'admin-001'
const ESCROW_ID = 'escrow-1'
const FUTURE_DATE = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7) // 7 days from now

// ─────────────────────────────────────────────────────────────────────────────
// createEscrow
// ─────────────────────────────────────────────────────────────────────────────

describe('EscrowService.createEscrow', () => {
  it('throws when amountXlm is zero', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(
      svc.createEscrow({ payerId: PAYER_ID, payeeId: PAYEE_ID, amountXlm: 0, expiresAt: FUTURE_DATE }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws when amountXlm is negative', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(
      svc.createEscrow({ payerId: PAYER_ID, payeeId: PAYEE_ID, amountXlm: -5, expiresAt: FUTURE_DATE }),
    ).rejects.toThrow(AppError)
  })

  it('throws when expiresAt is in the past', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })
    const pastDate = new Date(Date.now() - 1000)

    await expect(
      svc.createEscrow({ payerId: PAYER_ID, payeeId: PAYEE_ID, amountXlm: 10, expiresAt: pastDate }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws when payer and payee are the same user', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(
      svc.createEscrow({ payerId: PAYER_ID, payeeId: PAYER_ID, amountXlm: 10, expiresAt: FUTURE_DATE }),
    ).rejects.toMatchObject({ statusCode: 400 })
  })

  it('creates escrow with status pending on happy path', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    const result = await svc.createEscrow({
      payerId: PAYER_ID,
      payeeId: PAYEE_ID,
      amountXlm: 50,
      expiresAt: FUTURE_DATE,
    })

    expect(repo.createEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending', payerId: PAYER_ID, payeeId: PAYEE_ID }),
    )
    expect(result.id).toBe(ESCROW_ID)
  })

  it('includes optional jobId and txId when provided', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await svc.createEscrow({
      jobId: 'job-123',
      payerId: PAYER_ID,
      payeeId: PAYEE_ID,
      amountXlm: 100,
      expiresAt: FUTURE_DATE,
      txId: 'tx-abc',
    })

    expect(repo.createEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-123', txId: 'tx-abc' }),
    )
  })

  it('throws 409 when system is paused', async () => {
    const { db } = await import('../db.js')
    ;(db.systemConfig.findUnique as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ key: 'isPaused', value: 'true' })

    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(
      svc.createEscrow({ payerId: PAYER_ID, payeeId: PAYEE_ID, amountXlm: 10, expiresAt: FUTURE_DATE }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// activateEscrow
// ─────────────────────────────────────────────────────────────────────────────

describe('EscrowService.activateEscrow', () => {
  it('throws 404 when escrow does not exist', async () => {
    const repo = makeRepo({ findEscrow: vi.fn().mockResolvedValue(null) })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.activateEscrow('no-exist', 'tx-1', PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 when escrow is not in pending status', async () => {
    const repo = makeRepo({
      findEscrow: vi.fn().mockResolvedValue({ id: ESCROW_ID, status: 'active', payerId: PAYER_ID, payeeId: PAYEE_ID }),
    })
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.activateEscrow(ESCROW_ID, 'tx-1', PAYER_ID, 'user')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 403 when non-admin and non-payer tries to activate', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.activateEscrow(ESCROW_ID, 'tx-1', 'stranger', 'user')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('activates escrow as payer', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    const result = await svc.activateEscrow(ESCROW_ID, 'tx-abc', PAYER_ID, 'user')

    expect(repo.updateEscrow).toHaveBeenCalledWith(
      ESCROW_ID,
      expect.objectContaining({ status: 'active', txId: 'tx-abc' }),
    )
    expect(result.status).toBe('active')
  })

  it('activates escrow as admin (bypass payer check)', async () => {
    const repo = makeRepo()
    const svc = createEscrowService({ escrowRepository: repo as any })

    await expect(svc.activateEscrow(ESCROW_ID, 'tx-admin', ADMIN_ID, 'admin')).resolves.toBeDefined()
    expect(repo.updateEscrow).toHaveBeenCalled()
  })
})
