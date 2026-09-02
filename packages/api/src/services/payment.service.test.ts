import { beforeEach,describe, expect, it } from 'vitest'

import { calculateFee,PaymentService } from '../services/payment.service.js'

describe('PaymentService', () => {
  let svc: PaymentService

  beforeEach(() => {
    svc = new PaymentService(250) // fresh instance per test
  })

  // ── Fee management ──────────────────────────────────────────────────────────

  describe('getFeeBps / setFeeBps', () => {
    it('returns initial fee', () => {
      expect(svc.getFeeBps()).toBe(250)
    })

    it('admin can set fee', () => {
      svc.setFeeBps('admin', 100)
      expect(svc.getFeeBps()).toBe(100)
    })

    it('throws for non-admin', () => {
      expect(() => svc.setFeeBps('user', 100)).toThrow('Only admins can update the fee')
    })

    it('throws for fee_bps < 0', () => {
      expect(() => svc.setFeeBps('admin', -1)).toThrow('fee_bps must be between 0 and 10000')
    })

    it('throws for fee_bps > 10000', () => {
      expect(() => svc.setFeeBps('admin', 10_001)).toThrow('fee_bps must be between 0 and 10000')
    })

    it('allows fee_bps = 0', () => {
      svc.setFeeBps('admin', 0)
      expect(svc.getFeeBps()).toBe(0)
    })

    it('allows fee_bps = 10000', () => {
      svc.setFeeBps('admin', 10_000)
      expect(svc.getFeeBps()).toBe(10_000)
    })
  })

  describe('calculateFee', () => {
    it('calculates 2.5% fee', () => {
      expect(svc.calculateFee(10_000_000)).toBe(250_000)
    })

    it('returns 0 when fee is 0', () => {
      svc.setFeeBps('admin', 0)
      expect(svc.calculateFee(10_000_000)).toBe(0)
    })
  })

  // ── Tip ─────────────────────────────────────────────────────────────────────

  describe('tip', () => {
    it('returns correct tip breakdown', () => {
      const result = svc.tip({ from: 'ALICE', to: 'BOB', amount: 10_000_000 })
      expect(result).toEqual({
        from: 'ALICE',
        to: 'BOB',
        grossAmount: 10_000_000,
        fee: 250_000,
        netAmount: 9_750_000,
      })
    })

    it('throws for zero amount', () => {
      expect(() => svc.tip({ from: 'A', to: 'B', amount: 0 })).toThrow('Tip amount must be greater than 0')
    })

    it('throws for negative amount', () => {
      expect(() => svc.tip({ from: 'A', to: 'B', amount: -100 })).toThrow('Tip amount must be greater than 0')
    })

    it('throws when sender equals recipient', () => {
      expect(() => svc.tip({ from: 'ALICE', to: 'ALICE', amount: 100 })).toThrow(
        'Sender and recipient must be different'
      )
    })

    it('netAmount equals grossAmount when fee is 0', () => {
      svc.setFeeBps('admin', 0)
      const result = svc.tip({ from: 'A', to: 'B', amount: 5_000_000 })
      expect(result.fee).toBe(0)
      expect(result.netAmount).toBe(5_000_000)
    })

    it('fee + netAmount = grossAmount', () => {
      const result = svc.tip({ from: 'A', to: 'B', amount: 7_777_777 })
      expect(result.fee + result.netAmount).toBe(result.grossAmount)
    })
  })

  // ── Escrow ──────────────────────────────────────────────────────────────────

  describe('createEscrow', () => {
    const futureDate = new Date(Date.now() + 86_400_000)

    it('creates escrow with pending status', () => {
      const result = svc.createEscrow({ from: 'A', to: 'B', amount: 1_000, expiryDate: futureDate })
      expect(result).toEqual({ from: 'A', to: 'B', amount: 1_000, expiryDate: futureDate, status: 'pending' })
    })

    it('throws for past expiry', () => {
      const past = new Date(Date.now() - 1_000)
      expect(() => svc.createEscrow({ from: 'A', to: 'B', amount: 100, expiryDate: past })).toThrow(
        'Escrow expiry must be in the future'
      )
    })

    it('throws for zero amount', () => {
      expect(() => svc.createEscrow({ from: 'A', to: 'B', amount: 0, expiryDate: futureDate })).toThrow(
        'Escrow amount must be greater than 0'
      )
    })

    it('throws for negative amount', () => {
      expect(() => svc.createEscrow({ from: 'A', to: 'B', amount: -1, expiryDate: futureDate })).toThrow(
        'Escrow amount must be greater than 0'
      )
    })
  })
})

describe('calculateFee (standalone)', () => {
  it('calculates fee correctly', () => {
    expect(calculateFee(10_000_000, 250)).toBe(250_000)
  })

  it('throws for invalid fee_bps', () => {
    expect(() => calculateFee(100, -1)).toThrow()
    expect(() => calculateFee(100, 10_001)).toThrow()
  })
})
