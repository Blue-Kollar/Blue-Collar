import { AppError } from '../utils/AppError.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TipParams {
  from: string   // sender wallet address
  to: string     // recipient wallet address
  amount: number // in stroops (1 XLM = 10_000_000 stroops)
}

export interface EscrowParams {
  from: string
  to: string
  amount: number
  expiryDate: Date
}

export interface FeeConfig {
  fee_bps: number // basis points, e.g. 250 = 2.5%
}

// In-memory fee config (would be persisted in a real implementation)
let currentFeeBps = 250

// ── Fee helpers ───────────────────────────────────────────────────────────────

/**
 * Calculate the fee amount from a gross amount and a fee in basis points.
 * fee_bps = 0   → no fee
 * fee_bps = 500 → 5%
 */
export function calculateFee(amount: number, fee_bps: number): number {
  if (fee_bps < 0 || fee_bps > 10_000) {
    throw new AppError('fee_bps must be between 0 and 10000', 400)
  }
  return Math.floor((amount * fee_bps) / 10_000)
}

export function getFeeBps(): number {
  return currentFeeBps
}

export function updateFeeBps(callerRole: string, fee_bps: number): void {
  if (callerRole !== 'admin') {
    throw new AppError('Only admins can update the fee', 403)
  }
  if (fee_bps < 0 || fee_bps > 10_000) {
    throw new AppError('fee_bps must be between 0 and 10000', 400)
  }
  currentFeeBps = fee_bps
}

// ── Tip ───────────────────────────────────────────────────────────────────────

export interface TipResult {
  from: string
  to: string
  grossAmount: number
  fee: number
  netAmount: number
}

export function tip({ from, to, amount }: TipParams): TipResult {
  if (amount <= 0) {
    throw new AppError('Tip amount must be greater than 0', 400)
  }
  if (from === to) {
    throw new AppError('Sender and recipient must be different', 400)
  }

  const fee = calculateFee(amount, currentFeeBps)
  return { from, to, grossAmount: amount, fee, netAmount: amount - fee }
}

// ── Escrow ────────────────────────────────────────────────────────────────────

export interface EscrowResult {
  from: string
  to: string
  amount: number
  expiryDate: Date
  status: 'pending'
}

export function createEscrow({ from, to, amount, expiryDate }: EscrowParams): EscrowResult {
  if (expiryDate <= new Date()) {
    throw new AppError('Escrow expiry must be in the future', 400)
  }
  if (amount <= 0) {
    throw new AppError('Escrow amount must be greater than 0', 400)
  }
  return { from, to, amount, expiryDate, status: 'pending' }
}
