import { db } from '../db.js'
import { AppError } from './AppError.js'
import { logger } from '../config/logger.js'
import { sendVerificationStatusEmail } from '../mailer/index.js'

/** Submit a verification request for a worker */
export async function requestVerification(workerId: string, requestedById: string, documentUrl: string, notes?: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)
  if (worker.isVerified) throw new AppError('Worker is already verified', 409)

  const existing = await db.verificationRequest.findFirst({
    where: { workerId, status: 'pending' },
  })
  if (existing) throw new AppError('A pending verification request already exists', 409)

  return db.verificationRequest.create({
    data: { workerId, requestedById, documentUrl, notes },
    include: { worker: true },
  })
}

/** List verification requests (admin) */
export async function listRequests(status?: string, page = 1, limit = 20) {
  const where = status ? { status: status as any } : {}
  const [data, total] = await Promise.all([
    db.verificationRequest.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { worker: true, requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } } },
    }),
    db.verificationRequest.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

/** Review a verification request (admin) */
export async function reviewRequest(id: string, adminId: string, status: 'approved' | 'rejected', reviewNote?: string) {
  const request = await db.verificationRequest.findUnique({
    where: { id },
    include: { worker: true, requestedBy: true },
  })
  if (!request) throw new AppError('Verification request not found', 404)
  if (request.status !== 'pending') throw new AppError('Request already reviewed', 409)

  const updated = await db.verificationRequest.update({
    where: { id },
    data: { status, reviewedById: adminId, reviewNote },
    include: { worker: true, requestedBy: true },
  })

  // Update worker's isVerified badge
  if (status === 'approved') {
    await db.worker.update({ where: { id: request.workerId }, data: { isVerified: true } })
  }

  // Notify the requester
  sendVerificationStatusEmail(
    request.requestedBy.email,
    request.requestedBy.firstName,
    request.worker.name,
    status,
    reviewNote,
  ).catch((err) => logger.error({ err }, 'Failed to send verification status email'))

  return updated
}

/** Get verification requests for a specific worker */
export async function getWorkerVerifications(workerId: string) {
  return db.verificationRequest.findMany({
    where: { workerId },
    orderBy: { createdAt: 'desc' },
    include: { reviewedBy: { select: { id: true, firstName: true, lastName: true } } },
  })
}
