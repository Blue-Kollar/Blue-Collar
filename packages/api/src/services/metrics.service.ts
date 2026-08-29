import { db } from '../db.js'

interface ProtocolMetrics {
  timestamp: Date
  totalRegistrations: number
  activeWorkers: number
  totalTipVolume: number
  totalTipCount: number
  totalEscrowVolume: number
  activeEscrows: number
  totalDisputes: number
  resolvedDisputes: number
  dataFreshness: Date
}

export async function getProtocolMetrics(): Promise<ProtocolMetrics> {
  const [
    totalRegistrations,
    activeWorkers,
    tipAgg,
    disputes,
    resolvedDisputes,
  ] = await Promise.all([
    db.worker.count(),
    db.worker.count({ where: { isActive: true } }),
    db.workerAnalytics.aggregate({
      _sum: { totalTips: true, tipCount: true },
    }),
    db.dispute.count(),
    db.dispute.count({ where: { status: 'resolved' } }),
  ])

  return {
    timestamp: new Date(),
    totalRegistrations,
    activeWorkers,
    totalTipVolume: tipAgg._sum.totalTips ?? 0,
    totalTipCount: tipAgg._sum.tipCount ?? 0,
    totalEscrowVolume: 0, // Placeholder for on-chain data
    activeEscrows: 0, // Placeholder for on-chain data
    totalDisputes: disputes,
    resolvedDisputes,
    dataFreshness: new Date(),
  }
}

export async function getProtocolMetricsTimeSeries(days = 30) {
  const metrics: Array<{ date: string; registrations: number; tips: number; disputes: number }> = []
  
  for (let i = days - 1; i >= 0; i--) {
    const start = new Date()
    start.setDate(start.getDate() - i)
    start.setUTCHours(0, 0, 0, 0)
    
    const end = new Date(start)
    end.setDate(end.getDate() + 1)

    const [registrations, tips, disputes] = await Promise.all([
      db.worker.count({ where: { createdAt: { gte: start, lt: end } } }),
      db.workerAnalytics.aggregate({
        where: { updatedAt: { gte: start, lt: end } },
        _sum: { totalTips: true },
      }),
      db.dispute.count({ where: { createdAt: { gte: start, lt: end } } }),
    ])

    metrics.push({
      date: start.toISOString().split('T')[0],
      registrations,
      tips: tips._sum.totalTips ?? 0,
      disputes,
    })
  }

  return metrics
}
