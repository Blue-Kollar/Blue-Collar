import type { Request, Response } from 'express'
import { db } from '../db.js'

export async function getStats(_req: Request, res: Response) {
  const [totalUsers, totalWorkers, activeWorkers, totalJobs, verifiedWorkers] = await Promise.all([
    db.user.count(),
    db.worker.count({ where: { deletedAt: null } }),
    db.worker.count({ where: { isActive: true, deletedAt: null } }),
    db.job.count(),
    db.worker.count({ where: { isVerified: true, deletedAt: null } }),
  ])

  return res.json({
    status: 'success',
    data: {
      users: {
        total: totalUsers,
      },
      workers: {
        total: totalWorkers,
        active: activeWorkers,
        verified: verifiedWorkers,
      },
      jobs: {
        total: totalJobs,
      },
    },
  })
}
