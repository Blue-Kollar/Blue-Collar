import { AppError, ErrorCode } from '../utils/AppError.js'

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

export interface TipResult {
  from: string
  to: string
  grossAmount: number
  fee: number
  netAmount: number
}

export interface EscrowResult {
  from: string
  to: string
  amount: number
  expiryDate: Date
  status: 'pending'
}

// ── Multi-sig escrow types ────────────────────────────────────────────────────

export interface MultiSigEscrowParams {
  from: string
  to: string
  amount: number
  expiryDate: Date
  /** Addresses authorised to approve release (must be non-empty). */
  signers: string[]
  /** Number of approvals required (1 ≤ threshold ≤ signers.length). */
  threshold: number
}

export interface MultiSigEscrowResult {
  from: string
  to: string
  amount: number
  expiryDate: Date
  signers: string[]
  threshold: number
  approvals: string[]
  status: 'pending'
}

// ── Standalone helpers (kept for backward-compat & Stryker coverage) ─────────

export function calculateFee(amount: number, fee_bps: number): number {
  if (fee_bps < 0 || fee_bps > 10_000) {
    throw new AppError('fee_bps must be between 0 and 10000', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return Math.floor((amount * fee_bps) / 10_000)
}

// Module-level fee state (shared with PaymentService singleton)
let _feeBps = 250

export function getFeeBps(): number {
  return _feeBps
}

export function updateFeeBps(callerRole: string, fee_bps: number): void {
  if (callerRole !== 'admin') {
    throw new AppError('Only admins can update the fee', 403, true, ErrorCode.FORBIDDEN)
  }
  if (fee_bps < 0 || fee_bps > 10_000) {
    throw new AppError('fee_bps must be between 0 and 10000', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  _feeBps = fee_bps
}

export function tip({ from, to, amount }: TipParams): TipResult {
  if (amount <= 0) {
    throw new AppError('Tip amount must be greater than 0', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  if (from === to) {
    throw new AppError('Sender and recipient must be different', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const fee = calculateFee(amount, _feeBps)
  return { from, to, grossAmount: amount, fee, netAmount: amount - fee }
}

export function createEscrow({ from, to, amount, expiryDate }: EscrowParams): EscrowResult {
  if (expiryDate <= new Date()) {
    throw new AppError('Escrow expiry must be in the future', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  if (amount <= 0) {
    throw new AppError('Escrow amount must be greater than 0', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return { from, to, amount, expiryDate, status: 'pending' }
}

export function createMultiSigEscrow(params: MultiSigEscrowParams): MultiSigEscrowResult {
  const { from, to, amount, expiryDate, signers, threshold } = params
  if (expiryDate <= new Date()) {
    throw new AppError('Escrow expiry must be in the future', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  if (amount <= 0) {
    throw new AppError('Escrow amount must be greater than 0', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  if (signers.length === 0) {
    throw new AppError('At least one signer is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  if (threshold < 1 || threshold > signers.length) {
    throw new AppError('threshold must be between 1 and signers.length', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return { from, to, amount, expiryDate, signers, threshold, approvals: [], status: 'pending' }
}

// ── PaymentService class ──────────────────────────────────────────────────────

/**
 * PaymentService encapsulates all tip and escrow payment logic.
 * Controllers should use this class rather than calling the standalone
 * functions directly.
 */
export class PaymentService {
  private feeBps: number

  constructor(initialFeeBps = 250) {
    this.feeBps = initialFeeBps
  }

  // ── Fee management ──────────────────────────────────────────────────────────

  getFeeBps(): number {
    return this.feeBps
  }

  setFeeBps(callerRole: string, fee_bps: number): void {
    if (callerRole !== 'admin') {
      throw new AppError('Only admins can update the fee', 403, true, ErrorCode.FORBIDDEN)
    }
    if (fee_bps < 0 || fee_bps > 10_000) {
      throw new AppError('fee_bps must be between 0 and 10000', 400, true, ErrorCode.VALIDATION_ERROR)
    }
    this.feeBps = fee_bps
  }

  calculateFee(amount: number): number {
    return calculateFee(amount, this.feeBps)
  }

  // ── Tip ─────────────────────────────────────────────────────────────────────

  /**
   * Process a tip from one wallet to another.
   * Validates inputs, deducts the platform fee, and returns the breakdown.
   */
  tip(params: TipParams): TipResult {
    const { from, to, amount } = params
    if (amount <= 0) {
      throw new AppError('Tip amount must be greater than 0', 400, true, ErrorCode.VALIDATION_ERROR)
    }
    if (from === to) {
      throw new AppError('Sender and recipient must be different', 400, true, ErrorCode.VALIDATION_ERROR)
    }
    const fee = this.calculateFee(amount)
    return { from, to, grossAmount: amount, fee, netAmount: amount - fee }
  }

  // ── Escrow ──────────────────────────────────────────────────────────────────

  /**
   * Create a time-locked escrow payment.
   * The escrow is held until the expiry date, after which it can be released
   * or cancelled by the appropriate party.
   */
  createEscrow(params: EscrowParams): EscrowResult {
    const { from, to, amount, expiryDate } = params
    if (expiryDate <= new Date()) {
      throw new AppError('Escrow expiry must be in the future', 400, true, ErrorCode.VALIDATION_ERROR)
    }
    if (amount <= 0) {
      throw new AppError('Escrow amount must be greater than 0', 400, true, ErrorCode.VALIDATION_ERROR)
    }
    return { from, to, amount, expiryDate, status: 'pending' }
  }

  /**
   * Create a multi-signature escrow requiring threshold approvals before release.
   * Validates all inputs and returns the initial escrow state with an empty approvals list.
   */
  createMultiSigEscrow(params: MultiSigEscrowParams): MultiSigEscrowResult {
    return createMultiSigEscrow(params)
  }
}

// Singleton instance for use across the application
export const paymentService = new PaymentService()
