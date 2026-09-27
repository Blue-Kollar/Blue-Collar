import { db } from '@/db.js'
import { AppError } from '@/utils/AppError.js'

export async function registerOnChain(workerId: string, contractId: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  return db.worker.update({
    where: { id: workerId },
    data: { stellarContractId: contractId },
    include: { category: true, curator: true }
  })
}

/**
 * Sync a worker's on-chain reputation data into the local WorkerAnalytics row.
 *
 * This is called after any off-chain event (review submitted, tip recorded) that
 * should also be reflected in the database so the REST API can serve up-to-date
 * reputation data without requiring a live Stellar RPC call on every request.
 *
 * @param workerId  - Database worker id.
 * @param avgRating - New average rating (0-10000 basis points).
 * @param reviewCount - Total review count.
 * @param reputation  - Computed on-chain reputation score (0-10000 basis points).
 */
export async function syncReputationToDb(
  workerId: string,
  avgRating: number,
  reviewCount: number,
  reputation: number,
) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  await db.workerAnalytics.upsert({
    where: { workerId },
    update: {
      avgRating: avgRating / 100,         // convert bps → 0-100 scale
      reviewCount,
    },
    create: {
      workerId,
      avgRating: avgRating / 100,
      reviewCount,
    },
  })

  return db.worker.update({
    where: { id: workerId },
    data: { stellarContractId: worker.stellarContractId },
    include: { category: true, curator: true },
  })
}

/**
 * Get the combined on-chain reputation summary for a worker from the local DB.
 * This is a lightweight read-path that does not need a live Stellar RPC call.
 *
 * @param workerId - Database worker id.
 * @returns Reputation summary object, or null if not found.
 */
export async function getWorkerReputation(workerId: string) {
  const [worker, analytics] = await Promise.all([
    db.worker.findUnique({
      where: { id: workerId },
      select: { id: true, isVerified: true, stellarContractId: true },
    }),
    db.workerAnalytics.findUnique({
      where: { workerId },
      select: { avgRating: true, reviewCount: true },
    }),
  ])

  if (!worker) throw new AppError('Worker not found', 404)

  return {
    workerId,
    isVerified: worker.isVerified,
    stellarContractId: worker.stellarContractId ?? null,
    avgRating: analytics?.avgRating ?? 0,
    reviewCount: analytics?.reviewCount ?? 0,
  }
}
