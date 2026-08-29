import { db } from '../db.js'

export interface DateRangeFilter {
  startDate?: Date
  endDate?: Date
}

export async function getGrowthMetrics(filter: DateRangeFilter = {}) {
  const where = {
    createdAt: {
      ...(filter.startDate && { gte: filter.startDate }),
      ...(filter.endDate && { lte: filter.endDate }),
    },
  }

  const [newUsers, newWorkers, newReviews] = await Promise.all([
    db.user.count({ where }),
    db.worker.count({ where }),
    db.review.count({ where }),
  ])

  return { newUsers, newWorkers, newReviews }
}

export async function getEngagementMetrics(filter: DateRangeFilter = {}) {
  const where = {
    createdAt: {
      ...(filter.startDate && { gte: filter.startDate }),
      ...(filter.endDate && { lte: filter.endDate }),
    },
  }

  const [views, contacts, bookmarks] = await Promise.all([
    db.profileView.count({ where: { viewedAt: where.createdAt } }),
    db.contactRequest.count({ where }),
    db.bookmark.count({ where }),
  ])

  return { views, contacts, bookmarks }
}

export async function getRevenueMetrics(filter: DateRangeFilter = {}) {
  const where = {
    updatedAt: {
      ...(filter.startDate && { gte: filter.startDate }),
      ...(filter.endDate && { lte: filter.endDate }),
    },
  }

  const tipAgg = await db.workerAnalytics.aggregate({
    where,
    _sum: { totalTips: true, tipCount: true },
  })

  return {
    totalRevenue: tipAgg._sum.totalTips ?? 0,
    totalTransactions: tipAgg._sum.tipCount ?? 0,
  }
}

export async function getDisputeMetrics(filter: DateRangeFilter = {}) {
  const where = {
    createdAt: {
      ...(filter.startDate && { gte: filter.startDate }),
      ...(filter.endDate && { lte: filter.endDate }),
    },
  }

  const [total, resolved, pending] = await Promise.all([
    db.dispute.count({ where }),
    db.dispute.count({ where: { ...where, status: 'resolved' } }),
    db.dispute.count({ where: { ...where, status: 'pending' } }),
  ])

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

  return { total, resolved, pending, resolutionRate }
}

export async function getTopPerformers(metric: 'views' | 'tips' | 'bookmarks' = 'views', limit = 10) {
  const orderField = {
    views: 'totalViews',
    tips: 'totalTips',
    bookmarks: 'bookmarkCount',
  }[metric]

  const results = await db.workerAnalytics.findMany({
    orderBy: { [orderField]: 'desc' },
    take: limit,
    include: {
      worker: {
        select: {
          id: true,
          name: true,
          category: { select: { name: true } },
        },
      },
    },
  })

  return results.map((r) => ({
    workerId: r.workerId,
    workerName: r.worker.name,
    category: r.worker.category.name,
    value: r[orderField as keyof typeof r],
  }))
}
