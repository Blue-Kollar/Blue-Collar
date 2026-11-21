import { disputeRepository as defaultDisputeRepository } from '@/repositories/dispute.repository.js'
import { AppError, ErrorCode } from '@/utils/app-error.js'
import { sanitizeText } from '@/utils/sanitize.js'
import type { DisputeServiceDeps } from '@/container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createDisputeService(deps: DisputeServiceDeps) {
  const { disputeRepository: repo, transactionManager } = deps

  /**
   * Run `fn` inside a database transaction. Falls back to direct execution when
   * no transaction manager is injected (e.g. in unit tests).
   */
  function withTransaction<T>(fn: (tx: DisputeServiceDeps['disputeRepository']) => Promise<T>): Promise<T> {
    if (!transactionManager) return fn(repo)
    return transactionManager.run((tx) => fn(tx.disputeRepository))
  }

  return {
    /**
     * File a new dispute against a worker.
     *
     * The worker existence check, dispute creation and any related updates are
     * performed atomically so a failure cannot leave partial writes behind.
     */
    async fileDispute(workerId: string, filedById: string, reason: string, evidence?: string) {
      const sanitizedReason = sanitizeText(reason)
      const sanitizedEvidence = evidence === undefined ? undefined : sanitizeText(evidence)

      return withTransaction(async (tx) => {
        const worker = await tx.findWorkerById(workerId)
        if (!worker) throw new AppError('Worker not found', 404, true, ErrorCode.NOT_FOUND)

        return tx.createDispute({
          workerId,
          filedById,
          reason: sanitizedReason,
          evidence: sanitizedEvidence,
        })
      })
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
      if (role !== 'admin' && dispute.filedById !== userId) {
        throw new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN)
      }
      return dispute
    },

    /**
     * Resolve or dismiss a dispute (admin only).
     */
    async resolveDispute(id: string, adminId: string, status: 'resolved' | 'dismissed' | 'under_review', resolution?: string) {
      const sanitizedResolution = resolution === undefined ? undefined : sanitizeText(resolution)

      return withTransaction(async (tx) => {
        const dispute = await tx.findById(id)
        if (!dispute) throw new AppError('Dispute not found', 404, true, ErrorCode.NOT_FOUND)
        if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
          throw new AppError('Dispute has already been resolved', 409, true, ErrorCode.CONFLICT)
        }

        return tx.updateDispute(id, {
          status,
          resolution: sanitizedResolution,
          resolvedById: adminId,
        })
      })
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
