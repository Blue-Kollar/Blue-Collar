/**
 * Unit tests for the contracts service error contract.
 * Verifies that all error paths throw AppError with the correct statusCode and errorCode
 * so that the global errorHandler serializes them consistently.
 */

import { describe, it, expect } from 'vitest'
import { AppError, ErrorCode } from '../../utils/AppError.js'
import {
  createEscrowRecord,
  activateEscrowRecord,
  fileEscrowDispute,
  resolveEscrowDispute,
  fileWorkerDispute,
  processTip,
  createPaymentEscrow,
  updatePaymentFee,
} from '../../services/contracts.service.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function expectAppError(fn: () => unknown, statusCode: number, errorCode: ErrorCode) {
  try {
    const result = fn()
    if (result instanceof Promise) {
      // Caller must use async variant
    }
    expect.fail('Expected function to throw')
  } catch (err) {
    expect(err).toBeInstanceOf(AppError)
    expect((err as AppError).statusCode).toBe(statusCode)
    expect((err as AppError).errorCode).toBe(errorCode)
  }
}

async function expectAsyncAppError(fn: () => Promise<unknown>, statusCode: number, errorCode: ErrorCode) {
  await expect(fn()).rejects.toMatchObject({
    statusCode,
    errorCode,
  })
  await expect(fn()).rejects.toBeInstanceOf(AppError)
}

// ── createEscrowRecord ────────────────────────────────────────────────────────

describe('contracts.service.createEscrowRecord', () => {
  it('throws 400 VALIDATION_ERROR when payeeId is missing', async () => {
    await expectAsyncAppError(
      () => createEscrowRecord('payer-1', { payeeId: '', amountXlm: 10, expiresAt: new Date(Date.now() + 10000) }),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('throws 400 VALIDATION_ERROR when amountXlm is 0', async () => {
    await expectAsyncAppError(
      () => createEscrowRecord('payer-1', { payeeId: 'payee-1', amountXlm: 0, expiresAt: new Date(Date.now() + 10000) }),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('throws 400 VALIDATION_ERROR when expiresAt is missing', async () => {
    await expectAsyncAppError(
      () => createEscrowRecord('payer-1', { payeeId: 'payee-1', amountXlm: 10, expiresAt: undefined as any }),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })
})

// ── activateEscrowRecord ──────────────────────────────────────────────────────

describe('contracts.service.activateEscrowRecord', () => {
  it('throws 400 VALIDATION_ERROR when txId is empty', async () => {
    await expectAsyncAppError(
      () => activateEscrowRecord('esc-1', '', 'user-1', 'user'),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })
})

// ── fileEscrowDispute ─────────────────────────────────────────────────────────

describe('contracts.service.fileEscrowDispute', () => {
  it('throws 400 VALIDATION_ERROR when reason is empty', async () => {
    await expectAsyncAppError(
      () => fileEscrowDispute('esc-1', 'user-1', { reason: '' }),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })
})

// ── resolveEscrowDispute ──────────────────────────────────────────────────────

describe('contracts.service.resolveEscrowDispute', () => {
  it('throws 400 VALIDATION_ERROR for invalid status', async () => {
    await expectAsyncAppError(
      () => resolveEscrowDispute('dispute-1', 'admin-1', 'bad_status'),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('throws 400 VALIDATION_ERROR when status is empty', async () => {
    await expectAsyncAppError(
      () => resolveEscrowDispute('dispute-1', 'admin-1', ''),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('does not throw for valid status "resolved"', async () => {
    // Should pass validation (will fail later at db level, which is fine)
    await expect(resolveEscrowDispute('dispute-1', 'admin-1', 'resolved')).rejects.not.toMatchObject({
      errorCode: ErrorCode.VALIDATION_ERROR,
    })
  })
})

// ── fileWorkerDispute ─────────────────────────────────────────────────────────

describe('contracts.service.fileWorkerDispute', () => {
  it('throws 400 VALIDATION_ERROR when workerId is empty', async () => {
    await expectAsyncAppError(
      () => fileWorkerDispute('', 'user-1', 'Bad service'),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('throws 400 VALIDATION_ERROR when reason is empty', async () => {
    await expectAsyncAppError(
      () => fileWorkerDispute('worker-1', 'user-1', ''),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })
})

// ── processTip ────────────────────────────────────────────────────────────────

describe('contracts.service.processTip', () => {
  it('throws 400 VALIDATION_ERROR when from is missing', () => {
    expectAppError(() => processTip({ from: '', to: 'bob', amount: 100 }), 400, ErrorCode.VALIDATION_ERROR)
  })

  it('throws 400 VALIDATION_ERROR when to is missing', () => {
    expectAppError(() => processTip({ from: 'alice', to: '', amount: 100 }), 400, ErrorCode.VALIDATION_ERROR)
  })

  it('throws 400 VALIDATION_ERROR when amount is undefined', () => {
    expectAppError(() => processTip({ from: 'alice', to: 'bob', amount: undefined as any }), 400, ErrorCode.VALIDATION_ERROR)
  })

  it('returns a tip result for valid inputs', () => {
    const result = processTip({ from: 'ALICE', to: 'BOB', amount: 10_000_000 })
    expect(result).toMatchObject({ from: 'ALICE', to: 'BOB', grossAmount: 10_000_000 })
    expect(result.fee).toBeGreaterThanOrEqual(0)
    expect(result.fee + result.netAmount).toBe(result.grossAmount)
  })
})

// ── createPaymentEscrow ───────────────────────────────────────────────────────

describe('contracts.service.createPaymentEscrow', () => {
  const future = new Date(Date.now() + 86_400_000)

  it('throws 400 VALIDATION_ERROR when from is missing', () => {
    expectAppError(
      () => createPaymentEscrow({ from: '', to: 'bob', amount: 100, expiryDate: future }),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('throws 400 VALIDATION_ERROR when amount is missing', () => {
    expectAppError(
      () => createPaymentEscrow({ from: 'alice', to: 'bob', amount: undefined as any, expiryDate: future }),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('throws 400 VALIDATION_ERROR when expiryDate is missing', () => {
    expectAppError(
      () => createPaymentEscrow({ from: 'alice', to: 'bob', amount: 100, expiryDate: undefined as any }),
      400,
      ErrorCode.VALIDATION_ERROR,
    )
  })

  it('returns an escrow result for valid inputs', () => {
    const result = createPaymentEscrow({ from: 'alice', to: 'bob', amount: 100, expiryDate: future })
    expect(result).toMatchObject({ from: 'alice', to: 'bob', amount: 100, status: 'pending' })
  })
})

// ── updatePaymentFee ──────────────────────────────────────────────────────────

describe('contracts.service.updatePaymentFee', () => {
  it('throws 400 VALIDATION_ERROR when fee_bps is undefined', () => {
    expectAppError(() => updatePaymentFee('admin', undefined as any), 400, ErrorCode.VALIDATION_ERROR)
  })

  it('throws 403 FORBIDDEN for non-admin role', () => {
    expectAppError(() => updatePaymentFee('user', 100), 403, ErrorCode.FORBIDDEN)
  })
})
