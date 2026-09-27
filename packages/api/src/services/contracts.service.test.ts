/**
 * contracts.service.test.ts — unit tests for contracts service (#1369)
 *
 * Coverage for:
 *  - createEscrowRecord: validation (missing fields), successful creation
 *  - activateEscrowRecord: validation, successful activation
 *  - fileEscrowDispute: validation (missing reason), successful filing
 *  - resolveEscrowDispute: status validation, successful resolution
 *  - fileWorkerDispute: validation, successful filing
 *  - processTip: validation, successful processing
 *  - createPaymentEscrow: validation, successful creation
 *  - updatePaymentFee: validation, successful update
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createEscrowRecord,
  activateEscrowRecord,
  fileEscrowDispute,
  resolveEscrowDispute,
  fileWorkerDispute,
  processTip,
  createPaymentEscrow,
  getPaymentFee,
  updatePaymentFee,
} from './contracts.service.js'
import { AppError } from '../utils/AppError.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('./escrow.service.js', () => ({
  createEscrow: vi.fn().mockResolvedValue({
    id: 'escrow-1',
    payerId: 'payer-1',
    payeeId: 'payee-1',
    amountXlm: 100,
    status: 'pending',
  }),
  activateEscrow: vi.fn().mockResolvedValue({
    id: 'escrow-1',
    status: 'active',
  }),
  fileEscrowDispute: vi.fn().mockResolvedValue({
    id: 'dispute-1',
    escrowId: 'escrow-1',
  }),
  resolveEscrowDispute: vi.fn().mockResolvedValue({
    id: 'dispute-1',
    status: 'resolved',
  }),
}))

vi.mock('./dispute.service.js', () => ({
  fileDispute: vi.fn().mockResolvedValue({
    id: 'dispute-1',
    workerId: 'worker-1',
  }),
}))

vi.mock('./payment.service.js', () => ({
  paymentService: {
    tip: vi.fn().mockReturnValue({
      from: 'wallet-1',
      to: 'wallet-2',
      amount: 50,
    }),
    createEscrow: vi.fn().mockReturnValue({
      from: 'wallet-1',
      to: 'wallet-2',
      amount: 100,
    }),
    getFeeBps: vi.fn().mockReturnValue(100),
    setFeeBps: vi.fn(),
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// createEscrowRecord tests

describe('createEscrowRecord', () => {
  it('throws when payeeId is missing', async () => {
    const input = {
      amountXlm: 100,
      expiresAt: new Date(Date.now() + 86400000),
    }
    expect(() => createEscrowRecord('payer-1', input as never)).rejects.toThrow(AppError)
  })

  it('throws when amountXlm is missing', async () => {
    const input = {
      payeeId: 'payee-1',
      expiresAt: new Date(Date.now() + 86400000),
    }
    expect(() => createEscrowRecord('payer-1', input as never)).rejects.toThrow(AppError)
  })

  it('throws when expiresAt is missing', async () => {
    const input = {
      payeeId: 'payee-1',
      amountXlm: 100,
    }
    expect(() => createEscrowRecord('payer-1', input as never)).rejects.toThrow(AppError)
  })

  it('creates escrow with valid input', async () => {
    const input = {
      payeeId: 'payee-1',
      amountXlm: 100,
      expiresAt: new Date(Date.now() + 86400000),
      jobId: 'job-1',
    }
    const result = await createEscrowRecord('payer-1', input)
    expect(result).toBeDefined()
    expect(result.payerId).toBe('payer-1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// activateEscrowRecord tests

describe('activateEscrowRecord', () => {
  it('throws when txId is missing', () => {
    expect(() => activateEscrowRecord('escrow-1', '', 'caller-1', 'user')).rejects.toThrow(AppError)
  })

  it('activates escrow with valid txId', async () => {
    const result = await activateEscrowRecord('escrow-1', 'tx-abc123', 'caller-1', 'user')
    expect(result).toBeDefined()
    expect(result.status).toBe('active')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// fileEscrowDispute tests

describe('fileEscrowDispute', () => {
  it('throws when reason is missing', () => {
    const input = { reason: '' }
    expect(() => fileEscrowDispute('escrow-1', 'user-1', input)).rejects.toThrow(AppError)
  })

  it('files dispute with valid reason', async () => {
    const input = { reason: 'Payment not received' }
    const result = await fileEscrowDispute('escrow-1', 'user-1', input)
    expect(result).toBeDefined()
    expect(result.escrowId).toBe('escrow-1')
  })

  it('includes evidence when provided', async () => {
    const input = {
      reason: 'Payment not received',
      evidence: 'Screenshot of conversation',
    }
    const result = await fileEscrowDispute('escrow-1', 'user-1', input)
    expect(result).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveEscrowDispute tests

describe('resolveEscrowDispute', () => {
  it('throws when status is invalid', () => {
    expect(() =>
      resolveEscrowDispute('dispute-1', 'admin-1', 'invalid_status', 'Resolution text'),
    ).rejects.toThrow(AppError)
  })

  it('resolves dispute with under_review status', async () => {
    const result = await resolveEscrowDispute('dispute-1', 'admin-1', 'under_review')
    expect(result).toBeDefined()
    expect(result.status).toBe('resolved')
  })

  it('resolves dispute with resolved status', async () => {
    const result = await resolveEscrowDispute('dispute-1', 'admin-1', 'resolved', 'Full refund issued')
    expect(result).toBeDefined()
  })

  it('resolves dispute with dismissed status', async () => {
    const result = await resolveEscrowDispute('dispute-1', 'admin-1', 'dismissed', 'Claim invalid')
    expect(result).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// fileWorkerDispute tests

describe('fileWorkerDispute', () => {
  it('throws when workerId is missing', () => {
    expect(() => fileWorkerDispute('', 'user-1', 'Abuse')).rejects.toThrow(AppError)
  })

  it('throws when reason is missing', () => {
    expect(() => fileWorkerDispute('worker-1', 'user-1', '')).rejects.toThrow(AppError)
  })

  it('files worker dispute with valid input', async () => {
    const result = await fileWorkerDispute('worker-1', 'user-1', 'Abuse', 'Evidence link')
    expect(result).toBeDefined()
    expect(result.workerId).toBe('worker-1')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// processTip tests

describe('processTip', () => {
  it('throws when from is missing', () => {
    expect(() => processTip({ from: '', to: 'wallet-2', amount: 50 })).rejects.toThrow(AppError)
  })

  it('throws when to is missing', () => {
    expect(() => processTip({ from: 'wallet-1', to: '', amount: 50 })).rejects.toThrow(AppError)
  })

  it('throws when amount is undefined', () => {
    expect(() => processTip({ from: 'wallet-1', to: 'wallet-2', amount: undefined as never })).rejects.toThrow(
      AppError,
    )
  })

  it('processes tip with valid input', () => {
    const result = processTip({ from: 'wallet-1', to: 'wallet-2', amount: 50 })
    expect(result).toBeDefined()
    expect(result.amount).toBe(50)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// createPaymentEscrow tests

describe('createPaymentEscrow', () => {
  it('throws when from is missing', () => {
    expect(() =>
      createPaymentEscrow({ from: '', to: 'wallet-2', amount: 100, expiryDate: new Date() }),
    ).rejects.toThrow(AppError)
  })

  it('throws when to is missing', () => {
    expect(() =>
      createPaymentEscrow({ from: 'wallet-1', to: '', amount: 100, expiryDate: new Date() }),
    ).rejects.toThrow(AppError)
  })

  it('throws when amount is undefined', () => {
    expect(() =>
      createPaymentEscrow({ from: 'wallet-1', to: 'wallet-2', amount: undefined as never, expiryDate: new Date() }),
    ).rejects.toThrow(AppError)
  })

  it('throws when expiryDate is missing', () => {
    expect(() =>
      createPaymentEscrow({ from: 'wallet-1', to: 'wallet-2', amount: 100, expiryDate: null as never }),
    ).rejects.toThrow(AppError)
  })

  it('creates payment escrow with valid input', () => {
    const result = createPaymentEscrow({
      from: 'wallet-1',
      to: 'wallet-2',
      amount: 100,
      expiryDate: new Date(Date.now() + 86400000),
    })
    expect(result).toBeDefined()
    expect(result.amount).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Payment fee tests

describe('getPaymentFee', () => {
  it('returns current platform fee', () => {
    const fee = getPaymentFee()
    expect(fee).toBe(100)
  })
})

describe('updatePaymentFee', () => {
  it('throws when fee_bps is undefined', () => {
    expect(() => updatePaymentFee('admin', undefined as never)).rejects.toThrow(AppError)
  })

  it('updates payment fee with valid input', () => {
    const result = updatePaymentFee('admin', 150)
    expect(result).toBe(100)
  })
})
