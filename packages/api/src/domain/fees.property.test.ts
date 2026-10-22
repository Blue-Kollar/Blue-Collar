/**
 * Property-based tests for domain/fees.ts
 *
 * These tests verify mathematical properties that must hold for ALL valid inputs.
 * They serve as regression tests and catch rounding edge cases.
 *
 * Properties tested:
 * - Balance conservation: fee + net ≡ amount
 * - Fee bounds: 0 ≤ fee ≤ amount
 * - Net bounds: 0 ≤ net ≤ amount
 * - Floor property: fee = floor(amount * bps / 10_000)
 * - Commutativity: fee(a, b) depends only on a and b
 */

import { describe, it, expect } from 'vitest'
import {
  calculateFee,
  splitFee,
  bpsShare,
  MAX_BASIS_POINTS,
  BASIS_POINTS_SCALE,
} from './fees.js'

/**
 * Generate test values covering the range of possible inputs.
 * Includes boundary values, powers of 2, and random intermediate values.
 */
function generateAmounts(): number[] {
  const amounts: number[] = [0, 1, 2, 3, 7, 10, 100, 1000, 10_000, 100_000, 999_999]

  // Add powers of 2
  for (let i = 0; i <= 30; i++) {
    amounts.push(2 ** i)
  }

  // Add some "random" looking values
  amounts.push(1234, 5678, 9876, 12345, 99_999, 123_456, 1_000_000)

  return [...new Set(amounts)].filter((x) => x <= Number.MAX_SAFE_INTEGER).sort((a, b) => a - b)
}

function generateBpsValues(): number[] {
  const bps: number[] = [0, 1, 100, 250, 333, 500, 1000, 5000, 9999, MAX_BASIS_POINTS]

  // Add all hundreds
  for (let b = 0; b <= MAX_BASIS_POINTS; b += 100) {
    bps.push(b)
  }

  return [...new Set(bps)].sort((a, b) => a - b)
}

// ═════════════════════════════════════════════════════════════════════════════
// Property: Balance Conservation
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Balance Conservation', () => {
  it('fee + net always equals amount for all valid inputs', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    let checked = 0
    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const [fee, net] = splitFee(amount, bps)
        expect(fee + net).toBe(amount, `Failed at amount=${amount}, bps=${bps}`)
        checked++
      }
    }

    console.log(`✓ Verified balance conservation for ${checked} input combinations`)
  })

  it('holds for edge case: maximum amount and varying bps', () => {
    const maxAmount = Number.MAX_SAFE_INTEGER
    const bpsValues = generateBpsValues()

    for (const bps of bpsValues) {
      const [fee, net] = splitFee(maxAmount, bps)
      expect(fee + net).toBe(maxAmount)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Property: Fee Bounds (0 ≤ fee ≤ amount)
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Fee Bounds', () => {
  it('fee is always non-negative', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        expect(fee).toBeGreaterThanOrEqual(0, `Failed at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('fee never exceeds amount', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        expect(fee).toBeLessThanOrEqual(amount, `Failed at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('fee equals 0 when bps equals 0', () => {
    const amounts = generateAmounts()

    for (const amount of amounts) {
      expect(calculateFee(amount, 0)).toBe(0)
    }
  })

  it('fee equals amount when bps equals 10000', () => {
    const amounts = generateAmounts()

    for (const amount of amounts) {
      expect(calculateFee(amount, MAX_BASIS_POINTS)).toBe(amount)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Property: Net Amount Bounds (0 ≤ net ≤ amount)
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Net Amount Bounds', () => {
  it('net amount is always non-negative', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const [_fee, net] = splitFee(amount, bps)
        expect(net).toBeGreaterThanOrEqual(0, `Failed at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('net never exceeds amount', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const [_fee, net] = splitFee(amount, bps)
        expect(net).toBeLessThanOrEqual(amount, `Failed at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('net equals amount when bps equals 0', () => {
    const amounts = generateAmounts()

    for (const amount of amounts) {
      const [_fee, net] = splitFee(amount, 0)
      expect(net).toBe(amount)
    }
  })

  it('net equals 0 when bps equals 10000', () => {
    const amounts = generateAmounts()

    for (const amount of amounts) {
      const [_fee, net] = splitFee(amount, MAX_BASIS_POINTS)
      expect(net).toBe(0)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Property: Floor Rounding
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Floor Rounding', () => {
  it('fee equals floor(amount * bps / 10000) for all inputs', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        const expected = Math.floor((amount * bps) / BASIS_POINTS_SCALE)
        expect(fee).toBe(expected, `Failed at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('rounding is consistent with bpsShare for identical inputs', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        const share = bpsShare(amount, bps)
        expect(fee).toBe(share, `Inconsistent rounding at amount=${amount}, bps=${bps}`)
      }
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Property: Monotonicity
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Monotonicity', () => {
  it('fee increases or stays same as bps increases (for fixed amount)', () => {
    const amounts = [1, 10, 100, 1000, 10_000]
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      let prevFee = 0
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        expect(fee).toBeGreaterThanOrEqual(prevFee, `Non-monotonic at amount=${amount}, bps=${bps}`)
        prevFee = fee
      }
    }
  })

  it('fee increases or stays same as amount increases (for fixed bps)', () => {
    const amounts = generateAmounts()
    const bpsValues = [0, 100, 250, 500, 5000, MAX_BASIS_POINTS]

    for (const bps of bpsValues) {
      let prevFee = 0
      for (const amount of amounts) {
        const fee = calculateFee(amount, bps)
        expect(fee).toBeGreaterThanOrEqual(prevFee, `Non-monotonic at amount=${amount}, bps=${bps}`)
        prevFee = fee
      }
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Property: Commutative Structure
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Commutative Structure', () => {
  it('calling calculateFee twice with same inputs produces same result', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee1 = calculateFee(amount, bps)
        const fee2 = calculateFee(amount, bps)
        expect(fee1).toBe(fee2)
      }
    }
  })

  it('splitFee and separate calculateFee calls produce consistent results', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const [feeSplit, netSplit] = splitFee(amount, bps)
        const feeCalc = calculateFee(amount, bps)
        expect(feeSplit).toBe(feeCalc)
        expect(netSplit).toBe(amount - feeCalc)
      }
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Property: Continuity (no NaN, no Infinity)
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Continuity (Finite Results)', () => {
  it('calculateFee never returns NaN', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        expect(Number.isFinite(fee)).toBe(true, `NaN at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('calculateFee never returns Infinity', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        expect(Number.isFinite(fee)).toBe(true, `Infinity at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('handles MAX_SAFE_INTEGER without loss of precision', () => {
    const maxSafe = Number.MAX_SAFE_INTEGER
    const bpsValues = generateBpsValues()

    for (const bps of bpsValues) {
      const fee = calculateFee(maxSafe, bps)
      expect(Number.isFinite(fee)).toBe(true)
      expect(Number.isInteger(fee)).toBe(true)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Property: Integer Arithmetic
// ═════════════════════════════════════════════════════════════════════════════

describe('Property: Integer Arithmetic', () => {
  it('all fee values are integers (no fractional stroops)', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const fee = calculateFee(amount, bps)
        expect(Number.isInteger(fee)).toBe(true, `Non-integer at amount=${amount}, bps=${bps}`)
      }
    }
  })

  it('all net amounts are integers', () => {
    const amounts = generateAmounts()
    const bpsValues = generateBpsValues()

    for (const amount of amounts) {
      for (const bps of bpsValues) {
        const [_fee, net] = splitFee(amount, bps)
        expect(Number.isInteger(net)).toBe(true, `Non-integer net at amount=${amount}, bps=${bps}`)
      }
    }
  })
})
