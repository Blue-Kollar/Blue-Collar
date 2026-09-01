/**
 * Escrow orchestration service.
 * Mirrors the on-chain escrow lifecycle in the DB and notifies parties on transitions.
 */
import { db } from '../db.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { dispatchNotification } from './notification.service.js'

// ── helpers ───────────────────────────────────────────────────────────────────

function notifyBoth(payerId: string, payeeId: string, title: string, message: string, href?: string) {
  // `channels` must match the NotificationChannel union type from the notification service.
  // Listing literals inline and casting avoids importing the full union type here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- NotificationChannel union cast
  const payload = { type: 'system' as const, title, message, href, channels: ['inapp', 'email'] as any }
  dispatchNotification({ userId: payerId, ...payload }).catch(() => {})
  dispatchNotification({ userId: payeeId, ...payload }).catch(() => {})
}

// ── Escrow CRUD ───────────────────────────────────────────────────────────────

/**
 * Create a new escrow record (mirrors an on-chain escrow creation).
 */
export async function createEscrow(data: {
  jobId?: string
  payerId: string
  payeeId: string
  amountXlm: number
  expiresAt: Date
  txId?: string
}) {
  if (data.amountXlm <= 0) throw new AppError('amountXlm must be greater than 0', 400, true, ErrorCode.VALIDATION_ERROR)
  if (data.expiresAt <= new Date()) throw new AppError('expiresAt must be in the future', 400, true, ErrorCode.VALIDATION_ERROR)
  if (data.payerId === data.payeeId) throw new AppError('Payer and payee must be different', 400, true, ErrorCode.VALIDATION_ERROR)

  const record = await db.escrowRecord.create({ data: { ...data, status: 'pending' } })

  notifyBoth(
    data.payerId,
    data.payeeId,
    'Escrow created',
    `An escrow of ${data.amountXlm} XLM has been created.`,
    `/escrow/${record.id}`,
  )

  return record
}

/**
 * Activate an escrow (funds confirmed on-chain).
 * Only the payer (or admin) should call this.
 */
export async function activateEscrow(id: string, txId: string, callerId: string, callerRole: string) {
  const record = await db.escrowRecord.findUnique({ where: { id } })
  if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
  if (record.status !== 'pending') throw new AppError('Only pending escrows can be activated', 400, true, ErrorCode.VALIDATION_ERROR)
  if (callerRole !== 'admin' && record.payerId !== callerId) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)

  const updated = await db.escrowRecord.update({
    where: { id },
    data: { status: 'active', txId },
  })

  notifyBoth(
    record.payerId,
    record.payeeId,
    'Escrow active',
    `Escrow ${id} is now active. Funds are locked until release or expiry.`,
    `/escrow/${id}`,
  )

  return updated
}

/**
 * Release an escrow to the payee.
 * Only the payer (or admin) should call this.
 */
export async function releaseEscrow(id: string, callerId: string, callerRole: string) {
  const record = await db.escrowRecord.findUnique({ where: { id } })
  if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
  if (record.status !== 'active') throw new AppError('Only active escrows can be released', 400, true, ErrorCode.VALIDATION_ERROR)
  if (callerRole !== 'admin' && record.payerId !== callerId) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)

  const updated = await db.escrowRecord.update({
    where: { id },
    data: { status: 'released', releasedAt: new Date() },
  })

  notifyBoth(
    record.payerId,
    record.payeeId,
    'Escrow released',
    `Escrow ${id} has been released. Funds are on their way to the payee.`,
    `/escrow/${id}`,
  )

  return updated
}

/**
 * Cancel an escrow (time-locked: only after expiry, or by admin).
 */
export async function cancelEscrow(id: string, callerId: string, callerRole: string) {
  const record = await db.escrowRecord.findUnique({ where: { id } })
  if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
  if (record.status !== 'active' && record.status !== 'pending') {
    throw new AppError('Only pending/active escrows can be cancelled', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const now = new Date()
  if (callerRole !== 'admin' && record.payerId !== callerId) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
  if (callerRole !== 'admin' && record.expiresAt > now) {
    throw new AppError('Escrow is still within the lock period', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const updated = await db.escrowRecord.update({
    where: { id },
    data: { status: 'cancelled', cancelledAt: now },
  })

  notifyBoth(
    record.payerId,
    record.payeeId,
    'Escrow cancelled',
    `Escrow ${id} has been cancelled.`,
    `/escrow/${id}`,
  )

  return updated
}

export async function getEscrow(id: string, callerId: string, callerRole: string) {
  const record = await db.escrowRecord.findUnique({
    where: { id },
    include: { disputes: true },
  })
  if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
  if (callerRole !== 'admin' && record.payerId !== callerId && record.payeeId !== callerId) {
    throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
  }
  return record
}

export async function listEscrows(callerId: string, callerRole: string, page = 1, limit = 20) {
  const where = callerRole === 'admin' ? {} : { OR: [{ payerId: callerId }, { payeeId: callerId }] }
  const [data, total] = await Promise.all([
    db.escrowRecord.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { disputes: true } } },
    }),
    db.escrowRecord.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

// ── Dispute intake ────────────────────────────────────────────────────────────

/**
 * File a dispute against an active escrow.
 */
export async function fileEscrowDispute(
  escrowId: string,
  filedById: string,
  reason: string,
  evidence?: string,
) {
  const record = await db.escrowRecord.findUnique({ where: { id: escrowId } })
  if (!record) throw new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND)
  if (record.payerId !== filedById && record.payeeId !== filedById) throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
  if (record.status === 'released' || record.status === 'cancelled') {
    throw new AppError('Cannot dispute a completed escrow', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const [dispute] = await db.$transaction([
    db.escrowDispute.create({ data: { escrowId, filedById, reason, evidence } }),
    db.escrowRecord.update({ where: { id: escrowId }, data: { status: 'disputed' } }),
  ])

  const otherId = record.payerId === filedById ? record.payeeId : record.payerId
  dispatchNotification({
    userId: otherId,
    type: 'system',
    title: 'Escrow dispute filed',
    message: `A dispute has been filed on escrow ${escrowId}.`,
    href: `/escrow/${escrowId}`,
    channels: ['inapp', 'email'],
  }).catch(() => {})

  return dispute
}

/**
 * Update the status of an escrow dispute (admin only).
 */
export async function resolveEscrowDispute(
  disputeId: string,
  adminId: string,
  status: 'under_review' | 'resolved' | 'dismissed',
  resolution?: string,
) {
  const dispute = await db.escrowDispute.findUnique({
    where: { id: disputeId },
    include: { escrow: true },
  })
  if (!dispute) throw new AppError('Dispute not found', 404, true, ErrorCode.NOT_FOUND)

  const updated = await db.escrowDispute.update({
    where: { id: disputeId },
    data: { status, resolution, resolvedAt: status !== 'under_review' ? new Date() : undefined },
  })

  // If resolved/dismissed, update escrow status based on outcome
  if (status === 'resolved' || status === 'dismissed') {
    const escrowStatus = status === 'resolved' ? 'released' : 'cancelled'
    await db.escrowRecord.update({
      where: { id: dispute.escrowId },
      data: {
        status: escrowStatus,
        releasedAt: escrowStatus === 'released' ? new Date() : undefined,
        cancelledAt: escrowStatus === 'cancelled' ? new Date() : undefined,
      },
    })

    notifyBoth(
      dispute.escrow.payerId,
      dispute.escrow.payeeId,
      `Escrow dispute ${status}`,
      `The dispute on escrow ${dispute.escrowId} has been ${status}. ${resolution ?? ''}`.trim(),
      `/escrow/${dispute.escrowId}`,
    )
  }

  await db.auditLog.create({
    data: {
      userId: adminId,
      action: `escrow.dispute.${status}`,
      resource: 'EscrowDispute',
      resourceId: disputeId,
      meta: { resolution: resolution ?? null },
    },
  })

  return updated
}
