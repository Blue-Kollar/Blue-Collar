/**
 * Contracts service — unified orchestration layer for all smart-contract-backed
 * operations (escrow, disputes, payments).
 *
 * Controllers in the contracts domain should call this service rather than
 * reaching into escrow.service, dispute.service, or payment.service directly.
 * This keeps controllers thin (parse → call service → respond) and centralises
 * all business-rule enforcement in one testable module.
 */

import { AppError, ErrorCode } from '../utils/AppError.js'
import * as escrowService from './escrow.service.js'
import * as disputeService from './dispute.service.js'
import { paymentService, type TipParams, type EscrowParams } from './payment.service.js'

// ── Re-exported types (so controllers only import from this module) ────────────

export type { TipParams, EscrowParams } from './payment.service.js'
export type { TipResult, EscrowResult } from './payment.service.js'

// ── Escrow operations ─────────────────────────────────────────────────────────

export interface CreateEscrowInput {
  jobId?: string
  payeeId: string
  amountXlm: number
  expiresAt: Date
  txId?: string
}

/**
 * Create a new escrow record for a payer→payee transfer.
 * Validates that required fields are present and delegates to escrow service.
 */
export async function createEscrowRecord(payerId: string, input: CreateEscrowInput) {
  const { payeeId, amountXlm, expiresAt, jobId, txId } = input
  if (!payeeId || !amountXlm || !expiresAt) {
    throw new AppError('payeeId, amountXlm and expiresAt are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return escrowService.createEscrow({
    jobId,
    payerId,
    payeeId,
    amountXlm: Number(amountXlm),
    expiresAt: new Date(expiresAt),
    txId,
  })
}

/**
 * Activate an escrow by confirming on-chain transaction id.
 */
export async function activateEscrowRecord(id: string, txId: string, callerId: string, callerRole: string) {
  if (!txId) {
    throw new AppError('txId is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return escrowService.activateEscrow(id, txId, callerId, callerRole)
}

export { escrowService as escrow }

// ── Dispute operations ────────────────────────────────────────────────────────

export interface FileEscrowDisputeInput {
  reason: string
  evidence?: string
}

/**
 * File a dispute against an escrow record.
 */
export async function fileEscrowDispute(escrowId: string, filedById: string, input: FileEscrowDisputeInput) {
  if (!input.reason) {
    throw new AppError('reason is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return escrowService.fileEscrowDispute(escrowId, filedById, input.reason, input.evidence)
}

export type ResolveDisputeStatus = 'under_review' | 'resolved' | 'dismissed'

/**
 * Resolve or update the status of an escrow dispute.
 */
export async function resolveEscrowDispute(
  disputeId: string,
  adminId: string,
  status: string,
  resolution?: string,
) {
  const validStatuses: ResolveDisputeStatus[] = ['under_review', 'resolved', 'dismissed']
  if (!status || !validStatuses.includes(status as ResolveDisputeStatus)) {
    throw new AppError('status must be under_review, resolved, or dismissed', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return escrowService.resolveEscrowDispute(disputeId, adminId, status as ResolveDisputeStatus, resolution)
}

/**
 * File a general dispute against a worker.
 */
export async function fileWorkerDispute(workerId: string, filedById: string, reason: string, evidence?: string) {
  if (!workerId || !reason) {
    throw new AppError('workerId and reason are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return disputeService.fileDispute(workerId, filedById, reason, evidence)
}

export { disputeService as dispute }

// ── Payment operations ────────────────────────────────────────────────────────

export interface TipInput {
  from: string
  to: string
  amount: number
}

/**
 * Process a tip payment from one wallet to another.
 */
export function processTip(input: TipInput) {
  const { from, to, amount } = input
  if (!from || !to || amount === undefined) {
    throw new AppError('from, to, and amount are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return paymentService.tip({ from, to, amount: Number(amount) })
}

export interface CreatePaymentEscrowInput {
  from: string
  to: string
  amount: number
  expiryDate: Date
}

/**
 * Create a time-locked payment escrow.
 */
export function createPaymentEscrow(input: CreatePaymentEscrowInput) {
  const { from, to, amount, expiryDate } = input
  if (!from || !to || amount === undefined || !expiryDate) {
    throw new AppError('from, to, amount, and expiryDate are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  return paymentService.createEscrow({ from, to, amount: Number(amount), expiryDate: new Date(expiryDate) })
}

/**
 * Get the current platform fee in basis points.
 */
export function getPaymentFee() {
  return paymentService.getFeeBps()
}

/**
 * Update the platform fee (admin only).
 */
export function updatePaymentFee(callerRole: string, fee_bps: number) {
  if (fee_bps === undefined) {
    throw new AppError('fee_bps is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  paymentService.setFeeBps(callerRole, fee_bps)
  return paymentService.getFeeBps()
}
