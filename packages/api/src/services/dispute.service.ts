import { db } from '../db.js'
import { AppError } from './AppError.js'

/**
 * File a new dispute against a worker.
 */
export async function fileDispute(workerId: string, filedById: string, reason: string, evidence?: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  return db.dispute.create({
    data: { workerId, filedById, reason, evidence },
    include: { worker: { select: { id: true, name: true } }, filedBy: { select: { id: true, firstName: true, lastName: true } } },
  })
}

/**
 * List disputes. Admins see all; users see only their own.
 */
export async function listDisputes(userId: string, role: string, page: number, limit: number) {
  const where = role === 'admin' ? {} : { filedById: userId }
  const [data, total] = await Promise.all([
    db.dispute.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { worker: { select: { id: true, name: true } }, filedBy: { select: { id: true, firstName: true, lastName: true } } },
    }),
    db.dispute.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

/**
 * Get a single dispute by id.
 */
export async function getDispute(id: string, userId: string, role: string) {
  const dispute = await db.dispute.findUnique({
    where: { id },
    include: { worker: { select: { id: true, name: true } }, filedBy: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!dispute) throw new AppError('Dispute not found', 404)
  if (role !== 'admin' && dispute.filedById !== userId) throw new AppError('Forbidden', 403)
  return dispute
}

/**
 * Resolve or dismiss a dispute (admin only).
 */
export async function resolveDispute(id: string, adminId: string, status: 'resolved' | 'dismissed' | 'under_review', resolution?: string) {
  const dispute = await db.dispute.findUnique({ where: { id } })
  if (!dispute) throw new AppError('Dispute not found', 404)

  return db.dispute.update({
    where: { id },
    data: { status, resolution, resolvedById: adminId },
    include: { worker: { select: { id: true, name: true } } },
  })
}
