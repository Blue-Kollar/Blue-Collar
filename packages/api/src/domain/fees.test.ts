/**
 * Unit tests for domain/fees.ts
 *
 * Tests the pure fee calculation functions with:
 * - Basic boundary values (0, 500, 10000 bps)
 * - Rounding behavior (floor for fractional stroops)
 * - Balance conservation (fee + net = amount)
 * - Error cases (invalid bps)
 * - Edge cases (0 amount, 1 amount, very large amounts)
 * - Invariant checks (helper functions)
 */

import { describe, it, expect } from 'vitest'
import {
  calculateFee,
  splitFee,
  bpsShare,
  validateBasisPoints,
  isValidBasisPoints,
  invariantBalanceConserved,
  invariantFeeNeverExceedsAmount,
  invariantNetNeverNegative,
  BASIS_POINTS_SCALE,
  MIN_BASIS_POINTS,
  MAX_BASIS_POINTS,
} from './fees.js'

// ═════════════════════════════════════════════════════════════════════════════
// calculateFee
// ═════════════════════════════════════════════════════════════════════════════

describe('calculateFee', () => {
  describe('basic calculation', () => {
    it('calculates 2.5% fee (250 bps) correctly', () => {
      expect(calculateFee(10_000, 250)).toBe(250)
    })

    it('calculates 5% fee (500 bps) correctly', () => {
      expect(calculateFee(10_000, 500)).toBe(500)
    })

    it('calculates 1% fee (100 bps) correctly', () => {
      expect(calculateFee(10_000, 100)).toBe(100)
    })

    it('handles 0% fee (0 bps)', () => {
      expect(calculateFee(10_000, 0)).toBe(0)
      expect(calculateFee(1, 0)).toBe(0)
    })

    it('charges full amount at 100% fee (10000 bps)', () => {
      expect(calculateFee(10_000, MAX_BASIS_POINTS)).toBe(10_000)
      expect(calculateFee(1, MAX_BASIS_POINTS)).toBe(1)
    })
  })

  describe('rounding behavior (floor)', () => {
    it('floors fractional stroops (1 stroop at 500 bps → 0)', () => {
      expect(calculateFee(1, 500)).toBe(0)
    })

    it('floors uneven division (7 stroops at 250 bps → 0)', () => {
      // 7 * 250 / 10000 = 0.175 → 0
      expect(calculateFee(7, 250)).toBe(0)
    })

    it('floors larger uneven division (2700 stroops at 250 bps → 67)', () => {
      // 2700 * 250 / 10000 = 67.5 → 67
      expect(calculateFee(2_700, 250)).toBe(67)
    })

    it('floors 0.5 stroop boundary (3 stroops at 500 bps → 0)', () => {
      // 3 * 500 / 10000 = 0.15 → 0
      expect(calculateFee(3, 500)).toBe(0)
    })

    it('rounds correctly for typical amounts', () => {
      // 99_999 stroops at 333 bps
      // 99_999 * 333 / 10000 = 3329.6667 → 3329
      expect(calculateFee(99_999, 333)).toBe(3_329)
    })
  })

  describe('edge cases', () => {
    it('returns 0 fee for 0 amount', () => {
      expect(calculateFee(0, 250)).toBe(0)
      expect(calculateFee(0, 500)).toBe(0)
    })

    it('handles 1 stroop amounts correctly', () => {
      expect(calculateFee(1, 0)).toBe(0)
      expect(calculateFee(1, 250)).toBe(0)
      expect(calculateFee(1, MAX_BASIS_POINTS)).toBe(1)
    })

    it('handles very large amounts without NaN or overflow', () => {
      const large = 1_000_000_000_000 // 1 trillion stroops
      expect(Number.isFinite(calculateFee(large, 250))).toBe(true)
      expect(calculateFee(large, 250)).toBe(25_000_000_000)
    })

    it('handles extremely large amounts (MAX_SAFE_INTEGER)', () => {
      const maxSafe = Number.MAX_SAFE_INTEGER
      expect(Number.isFinite(calculateFee(maxSafe, 100))).toBe(true)
      expect(calculateFee(maxSafe, 100)).toBe(Math.floor((maxSafe * 100) / 10_000))
    })
  })

  describe('validation', () => {
    it('throws RangeError for negative bps', () => {
      expect(() => calculateFee(10_000, -1)).toThrow(RangeError)
      expect(() => calculateFee(10_000, -100)).toThrow(RangeError)
    })

    it('throws RangeError for bps > 10000', () => {
      expect(() => calculateFee(10_000, 10_001)).toThrow(RangeError)
      expect(() => calculateFee(10_000, 20_000)).toThrow(RangeError)
    })

    it('throws RangeError for non-integer bps', () => {
      expect(() => calculateFee(10_000, 250.5)).toThrow(RangeError)
      expect(() => calculateFee(10_000, 250.1)).toThrow(RangeError)
    })

    it('accepts valid bps boundaries', () => {
      expect(() => calculateFee(10_000, 0)).not.toThrow()
      expect(() => calculateFee(10_000, MAX_BASIS_POINTS)).not.toThrow()
      expect(() => calculateFee(10_000, 250)).not.toThrow()
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// splitFee
// ═════════════════════════════════════════════════════════════════════════════

describe('splitFee', () => {
  describe('basic split', () => {
    it('splits 10000 stroops at 250 bps into 250 fee + 9750 net', () => {
      const [fee, net] = splitFee(10_000, 250)
      expect(fee).toBe(250)
      expect(net).toBe(9_750)
    })

    it('splits 10000 stroops at 500 bps into 500 fee + 9500 net', () => {
      const [fee, net] = splitFee(10_000, 500)
      expect(fee).toBe(500)
      expect(net).toBe(9_500)
    })

    it('splits with 0 bps fee (no deduction)', () => {
      const [fee, net] = splitFee(10_000, 0)
      expect(fee).toBe(0)
      expect(net).toBe(10_000)
    })

    it('splits with 100% fee (10000 bps)', () => {
      const [fee, net] = splitFee(10_000, MAX_BASIS_POINTS)
      expect(fee).toBe(10_000)
      expect(net).toBe(0)
    })
  })

  describe('balance conservation', () => {
    const testCases: Array<[amount: number, bps: number]> = [
      [10_000, 250],
      [10_000, 500],
      [1, 0],
      [1234, 100],
      [99_999, 333],
      [0, 250],
      [1, MAX_BASIS_POINTS],
    ]

    it.each(testCases)('conserves balance: fee + net = amount for %i stroops at %i bps', (amount, bps) => {
      const [fee, net] = splitFee(amount, bps)
      expect(fee + net).toBe(amount)
    })

    it('conserves balance for all basis points values', () => {
      const amount = 10_000
      for (let bps = 0; bps <= MAX_BASIS_POINTS; bps += 100) {
        const [fee, net] = splitFee(amount, bps)
        expect(fee + net).toBe(amount)
      }
    })
  })

  describe('invariants', () => {
    it('fee never exceeds amount', () => {
      for (let amount = 0; amount <= 10_000; amount += 1000) {
        for (let bps = 0; bps <= MAX_BASIS_POINTS; bps += 1000) {
          const [fee] = splitFee(amount, bps)
          expect(fee).toBeLessThanOrEqual(amount)
        }
      }
    })

    it('net is never negative', () => {
      for (let amount = 0; amount <= 10_000; amount += 1000) {
        for (let bps = 0; bps <= MAX_BASIS_POINTS; bps += 1000) {
          const [_fee, net] = splitFee(amount, bps)
          expect(net).toBeGreaterThanOrEqual(0)
        }
      }
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// bpsShare
// ═════════════════════════════════════════════════════════════════════════════

describe('bpsShare', () => {
  describe('basic sharing', () => {
    it('calculates 50% share (5000 bps)', () => {
      expect(bpsShare(10_000, 5_000)).toBe(5_000)
    })

    it('calculates 25% share (2500 bps)', () => {
      expect(bpsShare(100_000, 2_500)).toBe(25_000)
    })

    it('calculates 1% share (100 bps)', () => {
      expect(bpsShare(100_000, 100)).toBe(1_000)
    })

    it('returns 0 for 0% share', () => {
      expect(bpsShare(10_000, 0)).toBe(0)
    })

    it('returns full amount for 100% share', () => {
      expect(bpsShare(10_000, MAX_BASIS_POINTS)).toBe(10_000)
    })
  })

  describe('rounding behavior', () => {
    it('floors fractional shares (1 stroop at 5000 bps → 0)', () => {
      expect(bpsShare(1, 5_000)).toBe(0)
    })

    it('floors uneven division correctly', () => {
      expect(bpsShare(7, 250)).toBe(0)
      expect(bpsShare(999, 333)).toBe(33) // 999 * 333 / 10000 = 332.667 → 332
    })
  })

  describe('validation', () => {
    it('throws RangeError for invalid bps', () => {
      expect(() => bpsShare(10_000, -1)).toThrow(RangeError)
      expect(() => bpsShare(10_000, 10_001)).toThrow(RangeError)
    })

    it('accepts valid bps values', () => {
      expect(() => bpsShare(10_000, 0)).not.toThrow()
      expect(() => bpsShare(10_000, MAX_BASIS_POINTS)).not.toThrow()
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Validation functions
// ═════════════════════════════════════════════════════════════════════════════

describe('validateBasisPoints', () => {
  it('accepts valid bps values', () => {
    expect(() => validateBasisPoints(0)).not.toThrow()
    expect(() => validateBasisPoints(250)).not.toThrow()
    expect(() => validateBasisPoints(MAX_BASIS_POINTS)).not.toThrow()
  })

  it('throws RangeError for invalid values', () => {
    expect(() => validateBasisPoints(-1)).toThrow(RangeError)
    expect(() => validateBasisPoints(10_001)).toThrow(RangeError)
    expect(() => validateBasisPoints(250.5)).toThrow(RangeError)
  })
})

describe('isValidBasisPoints', () => {
  it('returns true for valid bps', () => {
    expect(isValidBasisPoints(0)).toBe(true)
    expect(isValidBasisPoints(250)).toBe(true)
    expect(isValidBasisPoints(MAX_BASIS_POINTS)).toBe(true)
  })

  it('returns false for invalid values', () => {
    expect(isValidBasisPoints(-1)).toBe(false)
    expect(isValidBasisPoints(10_001)).toBe(false)
    expect(isValidBasisPoints(250.5)).toBe(false)
    expect(isValidBasisPoints('250')).toBe(false)
    expect(isValidBasisPoints(null)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Invariant checks
// ═════════════════════════════════════════════════════════════════════════════

describe('Invariant checks', () => {
  describe('invariantBalanceConserved', () => {
    it('returns true for all valid amounts and bps', () => {
      for (let amount = 0; amount <= 1_000; amount += 100) {
        for (let bps = 0; bps <= MAX_BASIS_POINTS; bps += 1000) {
          expect(invariantBalanceConserved(amount, bps)).toBe(true)
        }
      }
    })
  })

  describe('invariantFeeNeverExceedsAmount', () => {
    it('returns true for all valid amounts and bps', () => {
      for (let amount = 0; amount <= 1_000; amount += 100) {
        for (let bps = 0; bps <= MAX_BASIS_POINTS; bps += 1000) {
          expect(invariantFeeNeverExceedsAmount(amount, bps)).toBe(true)
        }
      }
    })
  })

  describe('invariantNetNeverNegative', () => {
    it('returns true for all valid amounts and bps', () => {
      for (let amount = 0; amount <= 1_000; amount += 100) {
        for (let bps = 0; bps <= MAX_BASIS_POINTS; bps += 1000) {
          expect(invariantNetNeverNegative(amount, bps)).toBe(true)
        }
      }
    })
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Constants
// ═════════════════════════════════════════════════════════════════════════════

describe('Constants', () => {
  it('BASIS_POINTS_SCALE is 10000', () => {
    expect(BASIS_POINTS_SCALE).toBe(10_000)
  })

  it('MIN_BASIS_POINTS is 0', () => {
    expect(MIN_BASIS_POINTS).toBe(0)
  })

  it('MAX_BASIS_POINTS is 10000', () => {
    expect(MAX_BASIS_POINTS).toBe(10_000)
  })
})
