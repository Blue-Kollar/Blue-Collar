import { db } from '@/db.js'
import { nowUtc, addUtcMs, formatUtcIso } from '@/utils/date.js'

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
    timestamp: nowUtc(),
    totalRegistrations,
    activeWorkers,
    totalTipVolume: tipAgg._sum.totalTips ?? 0,
    totalTipCount: tipAgg._sum.tipCount ?? 0,
    totalEscrowVolume: 0, // Placeholder for on-chain data
    activeEscrows: 0, // Placeholder for on-chain data
    totalDisputes: disputes,
    resolvedDisputes,
    dataFreshness: nowUtc(),
  }
}

export async function getProtocolMetricsTimeSeries(days = 30) {
  const metrics: Array<{ date: string; registrations: number; tips: number; disputes: number }> = []
  
  for (let i = days - 1; i >= 0; i--) {
    const start = nowUtc()
    start.setUTCDate(start.getUTCDate() - i)
    start.setUTCHours(0, 0, 0, 0)

    const end = addUtcMs(start, 24 * 60 * 60 * 1000)

    const [registrations, tips, disputes] = await Promise.all([
      db.worker.count({ where: { createdAt: { gte: start, lt: end } } }),
      db.workerAnalytics.aggregate({
        where: { updatedAt: { gte: start, lt: end } },
        _sum: { totalTips: true },
      }),
      db.dispute.count({ where: { createdAt: { gte: start, lt: end } } }),
    ])

    metrics.push({
      date: formatUtcIso(start).slice(0, 10),
      registrations,
      tips: tips._sum.totalTips ?? 0,
      disputes,
    })
  }

  return metrics
}
