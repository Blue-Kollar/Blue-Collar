import { verificationRepository as defaultVerificationRepository } from '../repositories/verification.repository.js'
import { AppError } from './AppError.js'
import { logger } from '../config/logger.js'
import { sendVerificationStatusEmail } from '../mailer/index.js'
import type { VerificationServiceDeps } from '../container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createVerificationService(deps: VerificationServiceDeps) {
  const { verificationRepository: repo } = deps

  return {
    /** Submit a verification request for a worker */
    async requestVerification(workerId: string, requestedById: string, documentUrl: string, notes?: string) {
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)
      if ((worker as any).isVerified) throw new AppError('Worker is already verified', 409)

      const existing = await repo.findPendingByWorker(workerId)
      if (existing) throw new AppError('A pending verification request already exists', 409)

      return repo.createRequest({ workerId, requestedById, documentUrl, notes } as any)
    },

    /** List verification requests (admin) */
    async listRequests(status?: string, page = 1, limit = 20) {
      const where = status ? { status: status as any } : {}
      const { data, total } = await repo.findManyRequests(where, {
        skip: (page - 1) * limit,
        take: limit,
      })
      return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
    },

    /** Review a verification request (admin) */
    async reviewRequest(id: string, adminId: string, status: 'approved' | 'rejected', reviewNote?: string) {
      const request = await repo.findRequestById(id)
      if (!request) throw new AppError('Verification request not found', 404)
      if (request.status !== 'pending') throw new AppError('Request already reviewed', 409)

      const updated = await repo.updateRequest(id, { status, reviewedById: adminId, reviewNote } as any)

      if (status === 'approved') {
        await repo.updateWorkerVerified(request.workerId, true)
      }

      sendVerificationStatusEmail(
        (request as any).requestedBy.email,
        (request as any).requestedBy.firstName,
        (request as any).worker.name,
        status,
        reviewNote,
      ).catch((err) => logger.error({ err }, 'Failed to send verification status email'))

      return updated
    },

    /** Get verification requests for a specific worker */
    async getWorkerVerifications(workerId: string) {
      return repo.findRequestsByWorker(workerId)
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createVerificationService({
  verificationRepository: defaultVerificationRepository,
})

/** Submit a verification request for a worker */
export async function requestVerification(workerId: string, requestedById: string, documentUrl: string, notes?: string) {
  return _defaultService.requestVerification(workerId, requestedById, documentUrl, notes)
}

/** List verification requests (admin) */
export async function listRequests(status?: string, page = 1, limit = 20) {
  return _defaultService.listRequests(status, page, limit)
}

/** Review a verification request (admin) */
export async function reviewRequest(id: string, adminId: string, status: 'approved' | 'rejected', reviewNote?: string) {
  return _defaultService.reviewRequest(id, adminId, status, reviewNote)
}

/** Get verification requests for a specific worker */
export async function getWorkerVerifications(workerId: string) {
  return _defaultService.getWorkerVerifications(workerId)
}
