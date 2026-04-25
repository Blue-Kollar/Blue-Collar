import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'

/** Record a response to a contact request and stamp respondedAt */
export async function recordResponse(requestId: string, status: 'accepted' | 'declined') {
  const request = await db.contactRequest.findUnique({ where: { id: requestId } })
  if (!request) throw new AppError('Contact request not found', 404)
  if (request.status !== 'pending') throw new AppError('Request already responded to', 400)

  return db.contactRequest.update({
    where: { id: requestId },
    data: { status, respondedAt: new Date() },
    include: { fromUser: true, worker: true },
  })
}

/** Calculate average response time (ms) for a worker across all responded requests */
export async function getWorkerResponseStats(workerId: string) {
  const responded = await db.contactRequest.findMany({
    where: { workerId, respondedAt: { not: null } },
    select: { createdAt: true, respondedAt: true },
  })

  if (responded.length === 0) {
    return { avgResponseTimeMs: null, avgResponseTimeHours: null, totalResponded: 0, isFastResponder: false }
  }

  const totalMs = responded.reduce((sum, r) => sum + (r.respondedAt!.getTime() - r.createdAt.getTime()), 0)
  const avgMs = Math.round(totalMs / responded.length)
  const avgHours = parseFloat((avgMs / (1000 * 60 * 60)).toFixed(2))

  return {
    avgResponseTimeMs: avgMs,
    avgResponseTimeHours: avgHours,
    totalResponded: responded.length,
    isFastResponder: avgHours <= 2,
  }
}

/** Analytics: response time breakdown across all workers (admin) */
export async function getResponseTimeAnalytics() {
  const workers = await db.worker.findMany({
    select: { id: true, name: true, contactRequests: { select: { createdAt: true, respondedAt: true } } },
  })

  return workers
    .map((w) => {
      const responded = w.contactRequests.filter((r) => r.respondedAt)
      if (responded.length === 0) return { workerId: w.id, workerName: w.name, avgResponseTimeHours: null, totalResponded: 0 }
      const avgMs = responded.reduce((s, r) => s + (r.respondedAt!.getTime() - r.createdAt.getTime()), 0) / responded.length
      return {
        workerId: w.id,
        workerName: w.name,
        avgResponseTimeHours: parseFloat((avgMs / (1000 * 60 * 60)).toFixed(2)),
        totalResponded: responded.length,
      }
    })
    .sort((a, b) => (a.avgResponseTimeHours ?? Infinity) - (b.avgResponseTimeHours ?? Infinity))
}
