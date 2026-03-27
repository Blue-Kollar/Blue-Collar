import { describe, it, expect, beforeEach } from 'vitest'
import {
  tip,
  createEscrow,
  calculateFee,
  updateFeeBps,
  getFeeBps,
} from '../services/payment.service.js'
import { AppError } from '../utils/AppError.js'

// Reset fee to default before each test so tests are isolated
beforeEach(() => {
  updateFeeBps('admin', 250)
})

// ── Tip: amount = 0 ───────────────────────────────────────────────────────────

describe('tip – zero amount', () => {
  it('throws AppError(400) when amount is 0', () => {
    expect(() => tip({ from: 'wallet-a', to: 'wallet-b', amount: 0 }))
      .toThrow(AppError)
    expect(() => tip({ from: 'wallet-a', to: 'wallet-b', amount: 0 }))
      .toThrow('Tip amount must be greater than 0')
  })

  it('throws AppError(400) when amount is negative', () => {
    expect(() => tip({ from: 'wallet-a', to: 'wallet-b', amount: -100 }))
      .toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('does not return a result for a zero-amount tip', () => {
    let result: unknown
    try { result = tip({ from: 'wallet-a', to: 'wallet-b', amount: 0 }) } catch {}
    expect(result).toBeUndefined()
  })
})

// ── Tip: from === to (self-tip) ───────────────────────────────────────────────

describe('tip – self-tip', () => {
  it('throws AppError(400) when sender and recipient are the same', () => {
    expect(() => tip({ from: 'wallet-a', to: 'wallet-a', amount: 1000 }))
      .toThrow(AppError)
    expect(() => tip({ from: 'wallet-a', to: 'wallet-a', amount: 1000 }))
      .toThrow('Sender and recipient must be different')
  })

  it('returns statusCode 400 for self-tip', () => {
    expect(() => tip({ from: 'wallet-a', to: 'wallet-a', amount: 1000 }))
      .toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('succeeds when from and to are different', () => {
    const result = tip({ from: 'wallet-a', to: 'wallet-b', amount: 1000 })
    expect(result.from).toBe('wallet-a')
    expect(result.to).toBe('wallet-b')
  })
})

// ── Escrow: expiry in the past ────────────────────────────────────────────────

describe('createEscrow – past expiry', () => {
  it('throws AppError(400) when expiryDate is in the past', () => {
    const pastDate = new Date(Date.now() - 60_000) // 1 minute ago
    expect(() =>
      createEscrow({ from: 'wallet-a', to: 'wallet-b', amount: 5000, expiryDate: pastDate }),
    ).toThrow(AppError)
    expect(() =>
      createEscrow({ from: 'wallet-a', to: 'wallet-b', amount: 5000, expiryDate: pastDate }),
    ).toThrow('Escrow expiry must be in the future')
  })

  it('throws AppError(400) when expiryDate is exactly now', () => {
    // Date.now() will always be <= new Date() by the time the check runs
    const now = new Date(Date.now() - 1)
    expect(() =>
      createEscrow({ from: 'wallet-a', to: 'wallet-b', amount: 5000, expiryDate: now }),
    ).toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('succeeds when expiryDate is in the future', () => {
    const futureDate = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    const result = createEscrow({ from: 'wallet-a', to: 'wallet-b', amount: 5000, expiryDate: futureDate })
    expect(result.status).toBe('pending')
    expect(result.expiryDate).toEqual(futureDate)
  })
})

// ── Fee calculation: fee_bps = 0 and fee_bps = 500 ───────────────────────────

describe('calculateFee – boundary values', () => {
  it('returns 0 fee when fee_bps is 0', () => {
    expect(calculateFee(10_000, 0)).toBe(0)
    expect(calculateFee(1, 0)).toBe(0)
  })

  it('calculates 5% fee correctly when fee_bps is 500', () => {
    // 10_000 stroops * 500 bps = 500 stroops fee (5%)
    expect(calculateFee(10_000, 500)).toBe(500)
  })

  it('calculates 2.5% fee correctly when fee_bps is 250 (default)', () => {
    expect(calculateFee(10_000, 250)).toBe(250)
  })

  it('floors fractional stroops', () => {
    // 1 stroop * 500 bps = 0.05 → floors to 0
    expect(calculateFee(1, 500)).toBe(0)
  })

  it('throws AppError(400) when fee_bps exceeds 10000', () => {
    expect(() => calculateFee(10_000, 10_001))
      .toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('throws AppError(400) when fee_bps is negative', () => {
    expect(() => calculateFee(10_000, -1))
      .toThrowError(expect.objectContaining({ statusCode: 400 }))
  })

  it('tip netAmount reflects fee_bps = 0 (no deduction)', () => {
    updateFeeBps('admin', 0)
    const result = tip({ from: 'wallet-a', to: 'wallet-b', amount: 10_000 })
    expect(result.fee).toBe(0)
    expect(result.netAmount).toBe(10_000)
  })

  it('tip netAmount reflects fee_bps = 500 (5% deduction)', () => {
    updateFeeBps('admin', 500)
    const result = tip({ from: 'wallet-a', to: 'wallet-b', amount: 10_000 })
    expect(result.fee).toBe(500)
    expect(result.netAmount).toBe(9_500)
  })
})

// ── Fee update: only admin can update fee ─────────────────────────────────────

describe('updateFeeBps – role guard', () => {
  it('throws AppError(403) when a non-admin tries to update the fee', () => {
    expect(() => updateFeeBps('user', 100))
      .toThrow(AppError)
    expect(() => updateFeeBps('user', 100))
      .toThrow('Only admins can update the fee')
  })

  it('throws AppError(403) for curator role', () => {
    expect(() => updateFeeBps('curator', 100))
      .toThrowError(expect.objectContaining({ statusCode: 403 }))
  })

  it('allows admin to update the fee', () => {
    expect(() => updateFeeBps('admin', 300)).not.toThrow()
    expect(getFeeBps()).toBe(300)
  })

  it('fee does not change when a non-admin attempts an update', () => {
    const before = getFeeBps()
    try { updateFeeBps('user', 999) } catch {}
    expect(getFeeBps()).toBe(before)
  })

  it('admin can set fee to 0', () => {
    updateFeeBps('admin', 0)
    expect(getFeeBps()).toBe(0)
  })

  it('admin can set fee to max 10000 bps', () => {
    updateFeeBps('admin', 10_000)
    expect(getFeeBps()).toBe(10_000)
  })
})
