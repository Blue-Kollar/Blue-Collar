/**
 * Fee calculation domain module.
 *
 * This module contains pure functions for calculating platform fees based on
 * basis points (bps). It is shared with contract expectations and should be
 * kept in sync with the Rust implementations (split_fee, bps_share).
 *
 * Key invariants:
 * - Fee calculation uses floor rounding: Math.floor((amount * fee_bps) / 10_000)
 * - Basis points range: [0, 10_000] where 10_000 = 100%
 * - Balance conservation: fee + net = amount (always exactly)
 * - No rounding errors: floor operation ensures fee ≤ amount
 *
 * References:
 * - contracts/types/src/helpers.rs: split_fee, bps_share
 * - Issue #1640: Fee calculation domain module
 * - Issue #1590: Rounding consistency across contracts
 */

// ── Constants ─────────────────────────────────────────────────────────────────

/** Basis points per 100% */
export const BASIS_POINTS_SCALE = 10_000

/** Minimum valid basis points (no fee) */
export const MIN_BASIS_POINTS = 0

/** Maximum valid basis points (100% fee) */
export const MAX_BASIS_POINTS = 10_000

// ── Pure fee calculation functions ────────────────────────────────────────────

/**
 * Calculate the platform fee for a given amount and basis points.
 *
 * Formula: floor(amount * fee_bps / 10_000)
 *
 * The floor operation ensures fees are always integer stroops and never exceed
 * the original amount. This matches the Rust contract implementation.
 *
 * @param amount The transaction amount in stroops (must be non-negative)
 * @param feeBps The fee rate in basis points (0–10_000)
 * @returns The calculated fee (always ≤ amount)
 * @throws RangeError if feeBps is outside [0, 10_000]
 *
 * @example
 * calculateFee(10_000, 250)  // → 250 (2.5% fee)
 * calculateFee(10_000, 500)  // → 500 (5% fee)
 * calculateFee(1, 500)       // → 0 (rounds down)
 */
export function calculateFee(amount: number, feeBps: number): number {
  validateBasisPoints(feeBps)
  return Math.floor((amount * feeBps) / BASIS_POINTS_SCALE)
}

/**
 * Split an amount into fee and net components.
 *
 * This is the canonical fee split function that matches the Rust contract.
 * It guarantees: fee + net = amount (exact balance conservation).
 *
 * @param amount The total amount in stroops
 * @param feeBps The fee rate in basis points (0–10_000)
 * @returns Tuple [fee, net] where fee + net = amount
 * @throws RangeError if feeBps is outside [0, 10_000]
 *
 * @example
 * splitFee(10_000, 250)  // → [250, 9_750]
 * splitFee(10_000, 0)    // → [0, 10_000]
 * splitFee(1, 500)       // → [0, 1]
 */
export function splitFee(amount: number, feeBps: number): [fee: number, net: number] {
  const fee = calculateFee(amount, feeBps)
  const net = amount - fee
  return [fee, net]
}

/**
 * Calculate a basis-point weighted share of an amount (used for distribution).
 *
 * This is the contract's bps_share function for per-recipient fee distribution.
 * It uses the same floor rounding as calculateFee to ensure consistency.
 *
 * Formula: floor(amount * bps / 10_000)
 *
 * @param amount The total amount to be shared
 * @param bps The weight in basis points
 * @returns The weighted share (always ≤ amount)
 * @throws RangeError if bps is outside [0, 10_000]
 *
 * @example
 * bpsShare(100_000, 5_000)   // → 50_000 (50% of 100k)
 * bpsShare(100_000, 2_500)   // → 25_000 (25% of 100k)
 * bpsShare(1, 5_000)         // → 0 (rounds down)
 */
export function bpsShare(amount: number, bps: number): number {
  validateBasisPoints(bps)
  return Math.floor((amount * bps) / BASIS_POINTS_SCALE)
}

// ── Validation ────────────────────────────────────────────────────────────────

/**
 * Validate that a basis points value is within acceptable range.
 *
 * @param bps The basis points value to validate
 * @throws RangeError if bps is outside [0, 10_000]
 */
export function validateBasisPoints(bps: number): void {
  if (!Number.isInteger(bps) || bps < MIN_BASIS_POINTS || bps > MAX_BASIS_POINTS) {
    throw new RangeError(
      `Basis points must be an integer between ${MIN_BASIS_POINTS} and ${MAX_BASIS_POINTS}, got ${bps}`
    )
  }
}

/**
 * Check if a basis points value is valid.
 *
 * @param bps The basis points value to check
 * @returns true if bps is valid, false otherwise
 */
export function isValidBasisPoints(bps: unknown): boolean {
  return (
    typeof bps === 'number' &&
    Number.isInteger(bps) &&
    bps >= MIN_BASIS_POINTS &&
    bps <= MAX_BASIS_POINTS
  )
}

// ── Invariant checks (for testing and debugging) ─────────────────────────────

/**
 * Verify that fee calculation maintains balance conservation.
 *
 * For debugging: ensures that the fee split is mathematically correct.
 *
 * @param amount The amount to verify
 * @param feeBps The fee basis points
 * @returns true if fee + net = amount (should always be true)
 */
export function invariantBalanceConserved(amount: number, feeBps: number): boolean {
  const [fee, net] = splitFee(amount, feeBps)
  return fee + net === amount
}

/**
 * Verify that the fee never exceeds the amount.
 *
 * For debugging: ensures floor rounding prevents negative net amounts.
 *
 * @param amount The amount to verify
 * @param feeBps The fee basis points
 * @returns true if fee ≤ amount (should always be true)
 */
export function invariantFeeNeverExceedsAmount(amount: number, feeBps: number): boolean {
  const fee = calculateFee(amount, feeBps)
  return fee <= amount
}

/**
 * Verify that net amount is never negative.
 *
 * For debugging: ensures floor rounding prevents negative results.
 *
 * @param amount The amount to verify
 * @param feeBps The fee basis points
 * @returns true if net ≥ 0 (should always be true)
 */
export function invariantNetNeverNegative(amount: number, feeBps: number): boolean {
  const [_fee, net] = splitFee(amount, feeBps)
  return net >= 0
}
