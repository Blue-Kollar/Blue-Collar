/**
 * Escrow orchestration service.
 * Mirrors the on-chain escrow lifecycle in the DB and notifies parties on transitions.
 */
import { escrowRepository as defaultEscrowRepository } from '../repositories/escrow.repository.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { dispatchNotification } from './notification.service.js'
import { db } from '../db.js'
import type { EscrowServiceDeps } from '../container/types.js'

// ── Pause guard ───────────────────────────────────────────────────────────────

/**
 * Check whether the system is globally paused.
 * Throws 409 Conflict if paused, mirroring the on-chain `require_not_paused`.
 */
async function requireNotPaused() {
  const config = await db.systemConfig.findUnique({ where: { key: 'isPaused' } } as any)
  if (config && (config as any).value === 'true') {
    throw new AppError('System is paused — escrow operations are temporarily disabled', 409, true, ErrorCode.CONFLICT)
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function notifyBoth(payerId: string, payeeId: string, title: string, message: string, href?: string) {
  const payload = { type: 'system' as const, title, message, href, channels: ['inapp', 'email'] as any }
  dispatchNotification({ userId: payerId, ...payload }).catch(() => {})
  dispatchNotification({ userId: payeeId, ...payload }).catch(() => {})
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createEscrowService(deps: EscrowServiceDeps) {
  const { escrowRepository: repo } = deps

  return {
    /**
     * Create a new escrow record.
     */
    async createEscrow(data: {
      jobId?: string
      payerId: string
      payeeId: string
      amountXlm: number
      expiresAt: Date
      txId?: string
    }) {
      await requireNotPaused()
      if (data.amountXlm <= 0) throw new AppError('amountXlm must be greater than 0', 400, true, ErrorCode.VALIDATION_ERROR)
      if (data.expiresAt <= new Date()) throw new AppError('expiresAt must be in the future', 400, true, ErrorCode.VALIDATION_ERROR)
      if (data.payerId === data.payeeId) throw new AppError('Payer and payee must be different', 400, true, ErrorCode.VALIDATION_ERROR)

      const record = await repo.createEscrow({ ...data, status: 'pending' } as any)

      notifyBoth(data.payerId, data.payeeId, 'Escrow created', `An escrow of ${data.amountXlm} XLM has been created.`, `/escrow/${record.id}`)

      return record
    },

    /**
     * Activate an escrow (funds confirmed on-chain).
     */
    async activateEscrow(id: string, txId: string, callerId: string, callerRole: string) {
      const record = await repo.findEscrow(id)
      if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
      if (record.status !== 'pending') throw new AppError('Only pending escrows can be activated', 400, true, ErrorCode.VALIDATION_ERROR)
      if (callerRole !== 'admin' && (record as any).payerId !== callerId) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)

      const updated = await repo.updateEscrow(id, { status: 'active', txId } as any)

      notifyBoth((record as any).payerId, (record as any).payeeId, 'Escrow active', `Escrow ${id} is now active. Funds are locked until release or expiry.`, `/escrow/${id}`)

      return updated
    },

    /**
     * Release an escrow to the payee.
     */
    async releaseEscrow(id: string, callerId: string, callerRole: string) {
      const record = await repo.findEscrow(id)
      if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
      if (record.status !== 'active') throw new AppError('Only active escrows can be released', 400, true, ErrorCode.VALIDATION_ERROR)
      if (callerRole !== 'admin' && (record as any).payerId !== callerId) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)

      const updated = await repo.updateEscrow(id, { status: 'released', releasedAt: new Date() } as any)

      notifyBoth((record as any).payerId, (record as any).payeeId, 'Escrow released', `Escrow ${id} has been released. Funds are on their way to the payee.`, `/escrow/${id}`)

      return updated
    },

    /**
     * Cancel an escrow (time-locked: only after expiry, or by admin).
     */
    async cancelEscrow(id: string, callerId: string, callerRole: string) {
      const record = await repo.findEscrow(id)
      if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
      if (record.status !== 'active' && record.status !== 'pending') {
        throw new AppError('Only pending/active escrows can be cancelled', 400, true, ErrorCode.VALIDATION_ERROR)
      }
      const now = new Date()
      if (callerRole !== 'admin' && (record as any).payerId !== callerId) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
      if (callerRole !== 'admin' && (record as any).expiresAt > now) {
        throw new AppError('Escrow is still within the lock period', 400, true, ErrorCode.VALIDATION_ERROR)
      }

      const updated = await repo.updateEscrow(id, { status: 'cancelled', cancelledAt: now } as any)

      notifyBoth((record as any).payerId, (record as any).payeeId, 'Escrow cancelled', `Escrow ${id} has been cancelled.`, `/escrow/${id}`)

      return updated
    },

    async getEscrow(id: string, callerId: string, callerRole: string) {
      const record = await repo.findEscrowWithDisputes(id)
      if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
      if (callerRole !== 'admin' && (record as any).payerId !== callerId && (record as any).payeeId !== callerId) {
        throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
      }
      return record
    },

    async listEscrows(callerId: string, callerRole: string, page = 1, limit = 20) {
      const where = callerRole === 'admin' ? {} : { OR: [{ payerId: callerId }, { payeeId: callerId }] }
      const { data, total } = await repo.listEscrows(where as any, {
        skip: (page - 1) * limit,
        take: limit,
      })
      return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
    },

    /**
     * File a dispute against an active escrow.
     */
    async fileEscrowDispute(escrowId: string, filedById: string, reason: string, evidence?: string) {
      const record = await repo.findEscrow(escrowId)
      if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
      if ((record as any).payerId !== filedById && (record as any).payeeId !== filedById) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
      if ((record as any).status === 'released' || (record as any).status === 'cancelled') {
        throw new AppError('Cannot dispute a completed escrow', 400, true, ErrorCode.VALIDATION_ERROR)
      }

      // Create dispute and mark escrow as disputed atomically
      const newDispute = await repo.createDisputeAndMarkEscrow(escrowId, { escrowId, filedById, reason, evidence } as any)

      const otherId = (record as any).payerId === filedById ? (record as any).payeeId : (record as any).payerId
      dispatchNotification({
        userId: otherId,
        type: 'system',
        title: 'Escrow dispute filed',
        message: `A dispute has been filed on escrow ${escrowId}.`,
        href: `/escrow/${escrowId}`,
        channels: ['inapp', 'email'],
      }).catch(() => {})

      return newDispute
    },

    /**
     * Update the status of an escrow dispute (admin only).
     */
    async resolveEscrowDispute(
      disputeId: string,
      adminId: string,
      status: 'under_review' | 'resolved' | 'dismissed',
      resolution?: string,
    ) {
      const dispute = await repo.findDispute(disputeId)
      if (!dispute) throw new AppError('Dispute not found', 404, true, ErrorCode.NOT_FOUND)

      const updated = await repo.updateDispute(disputeId, {
        status,
        resolution,
        resolvedAt: status !== 'under_review' ? new Date() : undefined,
      } as any)

      if (status === 'resolved' || status === 'dismissed') {
        const escrowStatus = status === 'resolved' ? 'released' : 'cancelled'
        await repo.updateEscrow(dispute.escrowId, {
          status: escrowStatus,
          releasedAt: escrowStatus === 'released' ? new Date() : undefined,
          cancelledAt: escrowStatus === 'cancelled' ? new Date() : undefined,
        } as any)

        notifyBoth(
          dispute.escrow.payerId,
          dispute.escrow.payeeId,
          `Escrow dispute ${status}`,
          `The dispute on escrow ${dispute.escrowId} has been ${status}. ${resolution ?? ''}`.trim(),
          `/escrow/${dispute.escrowId}`,
        )
      }

      await repo.createAuditLog({
        userId: adminId,
        action: `escrow.dispute.${status}`,
        resource: 'EscrowDispute',
        resourceId: disputeId,
        meta: { resolution: resolution ?? null },
      } as any)

      return updated
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createEscrowService({
  escrowRepository: defaultEscrowRepository,
})

export async function createEscrow(data: {
  jobId?: string
  payerId: string
  payeeId: string
  amountXlm: number
  expiresAt: Date
  txId?: string
}) {
  return _defaultService.createEscrow(data)
}

export async function activateEscrow(id: string, txId: string, callerId: string, callerRole: string) {
  return _defaultService.activateEscrow(id, txId, callerId, callerRole)
}

export async function releaseEscrow(id: string, callerId: string, callerRole: string) {
  return _defaultService.releaseEscrow(id, callerId, callerRole)
}

export async function cancelEscrow(id: string, callerId: string, callerRole: string) {
  return _defaultService.cancelEscrow(id, callerId, callerRole)
}

export async function getEscrow(id: string, callerId: string, callerRole: string) {
  return _defaultService.getEscrow(id, callerId, callerRole)
}

export async function listEscrows(callerId: string, callerRole: string, page = 1, limit = 20) {
  return _defaultService.listEscrows(callerId, callerRole, page, limit)
}

export async function fileEscrowDispute(escrowId: string, filedById: string, reason: string, evidence?: string) {
  return _defaultService.fileEscrowDispute(escrowId, filedById, reason, evidence)
}

export async function resolveEscrowDispute(
  disputeId: string,
  adminId: string,
  status: 'under_review' | 'resolved' | 'dismissed',
  resolution?: string,
) {
  return _defaultService.resolveEscrowDispute(disputeId, adminId, status, resolution)
}

/**
 * Resolve a disputed escrow directly.
 * Guards against the system-paused bypass regression (#1028).
 *
 * @param escrowId  - the escrow record to resolve
 * @param outcome   - 'release' | 'cancel' — what happens to the funds
 * @param callerId  - the user requesting the resolution (must be admin)
 * @param callerRole - must be 'admin'
 */
export async function resolveDispute(
  escrowId: string,
  outcome: 'release' | 'cancel',
  callerId: string,
  callerRole: string,
) {
  await requireNotPaused()

  const record = await db.escrowRecord.findUnique({ where: { id: escrowId } } as any)
  if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
  if (callerRole !== 'admin') throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)

  const newStatus = outcome === 'release' ? 'released' : 'cancelled'
  const updated = await db.escrowRecord.update({
    where: { id: escrowId },
    data: {
      status: newStatus,
      ...(newStatus === 'released' ? { releasedAt: new Date() } : { cancelledAt: new Date() }),
    },
  } as any)

  notifyBoth(
    (record as any).payerId,
    (record as any).payeeId,
    `Escrow dispute resolved`,
    `The dispute on escrow ${escrowId} has been resolved. Outcome: ${outcome}.`,
    `/escrow/${escrowId}`,
  )

  return updated
}
