import { disputeRepository as defaultDisputeRepository } from '../repositories/dispute.repository.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import type { DisputeServiceDeps } from '../container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createDisputeService(deps: DisputeServiceDeps) {
  const { disputeRepository: repo } = deps

  return {
    /**
     * File a new dispute against a worker.
     */
    async fileDispute(workerId: string, filedById: string, reason: string, evidence?: string) {
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404, true, ErrorCode.NOT_FOUND)

      return repo.createDispute({ workerId, filedById, reason, evidence } as any)
    },

    /**
     * List disputes. Admins see all; users see only their own.
     */
    async listDisputes(userId: string, role: string, page: number, limit: number) {
      const where = role === 'admin' ? {} : { filedById: userId }
      const { data, total } = await repo.findManyWithRelations(where, {
        skip: (page - 1) * limit,
        take: limit,
      })
      return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
    },

    /**
     * Get a single dispute by id.
     */
    async getDispute(id: string, userId: string, role: string) {
      const dispute = await repo.findWithRelations(id)
      if (!dispute) throw new AppError('Dispute not found', 404, true, ErrorCode.NOT_FOUND)
      if (role !== 'admin' && (dispute as any).filedById !== userId) {
        throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
      }
      return dispute
    },

    /**
     * Resolve or dismiss a dispute (admin only).
     */
    async resolveDispute(id: string, adminId: string, status: 'resolved' | 'dismissed' | 'under_review', resolution?: string) {
      const dispute = await repo.findById(id)
      if (!dispute) throw new AppError('Dispute not found', 404, true, ErrorCode.NOT_FOUND)
      if ((dispute as any).status === 'resolved' || (dispute as any).status === 'dismissed') {
        throw new AppError('Dispute has already been resolved', 409, true, ErrorCode.CONFLICT)
      }

      return repo.updateDispute(id, { status, resolution, resolvedById: adminId } as any)
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createDisputeService({
  disputeRepository: defaultDisputeRepository,
})

/**
 * File a new dispute against a worker.
 */
export async function fileDispute(workerId: string, filedById: string, reason: string, evidence?: string) {
  return _defaultService.fileDispute(workerId, filedById, reason, evidence)
}

/**
 * List disputes. Admins see all; users see only their own.
 */
export async function listDisputes(userId: string, role: string, page: number, limit: number) {
  return _defaultService.listDisputes(userId, role, page, limit)
}

/**
 * Get a single dispute by id.
 */
export async function getDispute(id: string, userId: string, role: string) {
  return _defaultService.getDispute(id, userId, role)
}

/**
 * Resolve or dismiss a dispute (admin only).
 */
export async function resolveDispute(id: string, adminId: string, status: 'resolved' | 'dismissed' | 'under_review', resolution?: string) {
  return _defaultService.resolveDispute(id, adminId, status, resolution)
}
