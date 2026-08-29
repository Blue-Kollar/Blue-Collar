/**
 * Worker-level analytics — engagement/view/conversion metrics.
 *
 * Covers:
 *   - Recording profile views, tips, bookmark updates, contact events
 *   - Per-worker analytics summary (curator / admin)
 *   - Curator-aggregated analytics across all their workers
 *   - Daily view-trend series for a single worker
 *   - Personal worker dashboard with period-over-period deltas
 *   - Access-control guard (assertCanAccessWorkerAnalytics)
 *   - Date-range parsing helper (parseAnalyticsDateRange)
 */
import { db } from '../../db.js'
import { AppError } from '../AppError.js'
import { getErrorMessage } from '../../utils/getErrorMessage.js'
import {
  type DateRange,
  type TimeSeriesPoint,
  daysAgo,
  daysBefore,
  parseDateBoundary,
  dateRangeWhere,
  getPreviousRange,
  toRangePayload,
  dayKey,
  buildDailyMap,
  calcGrowthPct,
  calcRatingDelta,
} from './shared.js'

// ── Recording helpers ────────────────────────────────────────────────────────

/**
 * Records a profile view.  Deduplicates by IP within the current UTC day
 * to avoid inflating unique-view counts.
 */
export async function recordProfileView(workerId: string, ip: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const existing = await db.profileView.findFirst({
    where: { workerId, ip, viewedAt: { gte: today } },
  })

  await db.workerAnalytics.upsert({
    where: { workerId },
    create: { workerId, totalViews: 1, uniqueViews: existing ? 0 : 1 },
    update: {
      totalViews: { increment: 1 },
      ...(existing ? {} : { uniqueViews: { increment: 1 } }),
    },
  })

  if (!existing) {
    await db.profileView.create({ data: { workerId, ip } })
  }
}

/** Records a tip payment event and updates the worker analytics aggregate. */
export async function recordTip(workerId: string, amount: number, txHash?: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)
  if (!Number.isFinite(amount) || amount <= 0)
    throw new AppError('Tip amount must be greater than 0', 400)

  await db.$transaction([
    db.workerAnalytics.upsert({
      where: { workerId },
      create: { workerId, totalTips: amount, tipCount: 1 },
      update: { totalTips: { increment: amount }, tipCount: { increment: 1 } },
    }),
    db.workerTipEvent.create({ data: { workerId, amount, txHash } }),
  ])
}

/**
 * Increments (+1) or decrements (-1) the bookmark count for a worker.
 * Safe to call without checking whether the analytics row exists.
 */
export async function updateBookmarkCount(workerId: string, delta: 1 | -1) {
  await db.workerAnalytics.upsert({
    where: { workerId },
    create: { workerId, bookmarkCount: delta === 1 ? 1 : 0 },
    update: { bookmarkCount: { increment: delta } },
  })
}

/** Increments the contact-request counter for a worker. */
export async function recordContact(workerId: string) {
  await db.workerAnalytics.upsert({
    where: { workerId },
    create: { workerId, contactCount: 1 },
    update: { contactCount: { increment: 1 } },
  })
}

// ── Access control ───────────────────────────────────────────────────────────

/**
 * Throws `AppError(404)` if the worker doesn't exist, or `AppError(403)` if
 * `userId` is not the curator for that worker (unless `role === 'admin'`).
 *
 * Returns the minimal worker record on success.
 */
export async function assertCanAccessWorkerAnalytics(workerId: string, userId: string, role: string) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    select: { id: true, curatorId: true },
  })
  if (!worker) throw new AppError('Worker not found', 404)
  if (role !== 'admin' && worker.curatorId !== userId) throw new AppError('Forbidden', 403)
  return worker
}

// ── Date-range parsing ───────────────────────────────────────────────────────

/**
 * Parses `startDate`, `endDate`, and `days` from an Express query object into
 * a validated `Required<DateRange>`.
 *
 * Rules:
 *   - Defaults to the last 30 days when neither date is provided.
 *   - `days` is clamped to [1, 366].
 *   - startDate must be ≤ endDate.
 *   - The range cannot exceed 366 days.
 */
export function parseAnalyticsDateRange(
  query: { startDate?: unknown; endDate?: unknown; days?: unknown },
): Required<DateRange> {
  const now = new Date()
  let endDate: Date
  let startDate: Date

  try {
    endDate = parseDateBoundary(query.endDate, 'end') ?? now
    const defaultDays = Math.min(Math.max(Number(query.days) || 30, 1), 366)
    startDate = parseDateBoundary(query.startDate, 'start') ?? daysBefore(endDate, defaultDays - 1)
  } catch (err) {
    throw new AppError(getErrorMessage(err), 400)
  }

  if (startDate > endDate) throw new AppError('startDate must be before or equal to endDate', 400)

  const maxRangeMs = 366 * 24 * 60 * 60 * 1000
  if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
    throw new AppError('Date range cannot exceed 366 days', 400)
  }

  return { startDate, endDate }
}

// ── Worker analytics summary ─────────────────────────────────────────────────

/**
 * Returns a comprehensive analytics summary for a single worker.
 * Used by `GET /api/workers/:id/analytics`.
 */
export async function getWorkerAnalytics(workerId: string) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: { category: true },
  })
  if (!worker) throw new AppError('Worker not found', 404)

  const analytics = await db.workerAnalytics.findUnique({ where: { workerId } })

  const [reviewAgg, recentViews, recentContacts] = await Promise.all([
    db.review.aggregate({
      where: { workerId, status: 'approved' },
      _avg: { rating: true },
      _count: true,
    }),
    db.profileView.groupBy({
      by: ['workerId'],
      where: { workerId, viewedAt: { gte: daysAgo(30) } },
      _count: true,
    }),
    db.contactRequest.count({
      where: { workerId, createdAt: { gte: daysAgo(30) } },
    }),
  ])

  const respondedContacts = await db.contactRequest.count({
    where: { workerId, status: { not: 'pending' } },
  })
  const totalContacts = await db.contactRequest.count({ where: { workerId } })
  const responseRate =
    totalContacts > 0 ? Math.round((respondedContacts / totalContacts) * 100) : 0

  return {
    workerId,
    workerName: worker.name,
    category: worker.category.name,
    totalViews: analytics?.totalViews ?? 0,
    uniqueViews: analytics?.uniqueViews ?? 0,
    viewsLast30Days: recentViews[0]?._count ?? 0,
    totalTips: analytics?.totalTips ?? 0,
    tipCount: analytics?.tipCount ?? 0,
    bookmarkCount: analytics?.bookmarkCount ?? 0,
    contactCount: analytics?.contactCount ?? 0,
    contactsLast30Days: recentContacts,
    responseRate,
    avgRating: reviewAgg._avg.rating ?? 0,
    reviewCount: reviewAgg._count,
    updatedAt: analytics?.updatedAt ?? null,
  }
}

// ── Curator analytics ────────────────────────────────────────────────────────

/**
 * Returns an aggregated analytics summary for all workers managed by
 * a given curator.  Used by `GET /api/analytics/curator`.
 */
export async function getCuratorAnalytics(curatorId: string) {
  const workers = await db.worker.findMany({
    where: { curatorId },
    select: {
      id: true,
      name: true,
      isActive: true,
      category: { select: { name: true } },
    },
  })

  if (workers.length === 0) {
    return {
      totalWorkers: 0,
      activeWorkers: 0,
      workers: [],
      totals: { views: 0, uniqueViews: 0, tips: 0, tipCount: 0, bookmarks: 0, contacts: 0, avgRating: 0 },
    }
  }

  const workerIds = workers.map((w) => w.id)

  const [analyticsRows, reviewAgg, contactsThisMonth, viewsThisMonth] = await Promise.all([
    db.workerAnalytics.findMany({ where: { workerId: { in: workerIds } } }),
    db.review.aggregate({
      where: { workerId: { in: workerIds }, status: 'approved' },
      _avg: { rating: true },
      _count: true,
    }),
    db.contactRequest.count({
      where: { workerId: { in: workerIds }, createdAt: { gte: daysAgo(30) } },
    }),
    db.profileView.count({
      where: { workerId: { in: workerIds }, viewedAt: { gte: daysAgo(30) } },
    }),
  ])

  const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

  const workerSummaries = workers.map((w) => {
    const a = analyticsMap.get(w.id)
    return {
      id: w.id,
      name: w.name,
      category: w.category.name,
      isActive: w.isActive,
      views: a?.totalViews ?? 0,
      uniqueViews: a?.uniqueViews ?? 0,
      tips: a?.totalTips ?? 0,
      tipCount: a?.tipCount ?? 0,
      bookmarks: a?.bookmarkCount ?? 0,
      contacts: a?.contactCount ?? 0,
    }
  })

  const totals = analyticsRows.reduce(
    (acc, a) => ({
      views: acc.views + a.totalViews,
      uniqueViews: acc.uniqueViews + a.uniqueViews,
      tips: acc.tips + a.totalTips,
      tipCount: acc.tipCount + a.tipCount,
      bookmarks: acc.bookmarks + a.bookmarkCount,
      contacts: acc.contacts + a.contactCount,
    }),
    { views: 0, uniqueViews: 0, tips: 0, tipCount: 0, bookmarks: 0, contacts: 0 },
  )

  return {
    totalWorkers: workers.length,
    activeWorkers: workers.filter((w) => w.isActive).length,
    workers: workerSummaries,
    totals: {
      ...totals,
      avgRating: reviewAgg._avg.rating ?? 0,
      reviewCount: reviewAgg._count,
      contactsThisMonth,
      viewsThisMonth,
    },
  }
}

// ── View-trend series ────────────────────────────────────────────────────────

/**
 * Returns a daily view-count array for a worker over the last `days` calendar days.
 * Used by `GET /api/workers/:id/analytics/trends`.
 */
export async function getWorkerViewTrends(workerId: string, days = 30) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  const since = daysAgo(days)
  const views = await db.profileView.findMany({
    where: { workerId, viewedAt: { gte: since } },
    select: { viewedAt: true },
    orderBy: { viewedAt: 'asc' },
  })

  const dailyMap = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    dailyMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const v of views) {
    const key = v.viewedAt.toISOString().slice(0, 10)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }

  return Array.from(dailyMap.entries()).map(([date, count]) => ({ date, views: count }))
}

// ── Top-workers leaderboard ──────────────────────────────────────────────────

/**
 * Returns the top `limit` workers ranked by `metric`.
 * Used by `GET /api/analytics/top-workers`.
 */
export async function getTopWorkers(
  metric: 'views' | 'tips' | 'bookmarks' | 'rating',
  limit = 10,
) {
  const orderField = {
    views: 'totalViews',
    tips: 'totalTips',
    bookmarks: 'bookmarkCount',
    rating: 'avgRating',
  }[metric] as string

  const rows = await db.workerAnalytics.findMany({
    orderBy: { [orderField]: 'desc' },
    take: limit,
    include: { worker: { select: { name: true, category: { select: { name: true } } } } },
  })

  return rows.map((r, i) => ({
    rank: i + 1,
    workerId: r.workerId,
    workerName: r.worker.name,
    category: r.worker.category.name,
    totalViews: r.totalViews,
    totalTips: r.totalTips,
    bookmarkCount: r.bookmarkCount,
    avgRating: r.avgRating,
  }))
}

// ── Personal dashboard ───────────────────────────────────────────────────────

/**
 * Counts distinct IPs (≈ unique visitors) for `workerId` within `range`.
 * @internal
 */
async function countUniqueViews(workerId: string, range: Required<DateRange>) {
  const rows = await db.profileView.findMany({
    where: { workerId, viewedAt: dateRangeWhere(range) },
    select: { ip: true },
    distinct: ['ip'],
  })
  return rows.length
}

/**
 * Returns the full personal dashboard payload for a single worker.
 * Includes current-period summary metrics, period-over-period deltas,
 * a daily time-series chart, and a rating-distribution breakdown.
 *
 * Used by `GET /api/workers/:id/analytics/dashboard`.
 */
export async function getWorkerPersonalDashboard(workerId: string, range: Required<DateRange>) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    select: {
      id: true,
      name: true,
      walletAddress: true,
      category: { select: { name: true } },
    },
  })
  if (!worker) throw new AppError('Worker not found', 404)

  const dateWhere = dateRangeWhere(range)
  const previous = getPreviousRange(range)

  const [
    currentViews,
    previousViews,
    tipAgg,
    previousTipAgg,
    reviewAgg,
    previousReviewAgg,
    ratingDistribution,
    contacts,
    series,
  ] = await Promise.all([
    db.profileView.count({ where: { workerId, viewedAt: dateWhere } }),
    db.profileView.count({ where: { workerId, viewedAt: dateRangeWhere(previous) } }),
    db.workerTipEvent.aggregate({
      where: { workerId, createdAt: dateWhere },
      _sum: { amount: true },
      _count: true,
    }),
    db.workerTipEvent.aggregate({
      where: { workerId, createdAt: dateRangeWhere(previous) },
      _sum: { amount: true },
      _count: true,
    }),
    db.review.aggregate({
      where: { workerId, status: 'approved', createdAt: dateWhere },
      _avg: { rating: true },
      _count: true,
    }),
    db.review.aggregate({
      where: { workerId, status: 'approved', createdAt: dateRangeWhere(previous) },
      _avg: { rating: true },
      _count: true,
    }),
    db.review.groupBy({
      by: ['rating'],
      where: { workerId, status: 'approved', createdAt: dateWhere },
      _count: { rating: true },
      orderBy: { rating: 'desc' },
    }),
    db.contactRequest.count({ where: { workerId, createdAt: dateWhere } }),
    getWorkerDashboardSeries(workerId, range),
  ])

  const uniqueViews = await countUniqueViews(workerId, range)
  const previousUniqueViews = await countUniqueViews(workerId, previous)
  const earnings = tipAgg._sum.amount ?? 0
  const previousEarnings = previousTipAgg._sum.amount ?? 0

  return {
    worker: {
      id: worker.id,
      name: worker.name,
      category: worker.category.name,
      walletAddress: worker.walletAddress,
    },
    range: toRangePayload(range),
    summary: {
      totalViews: currentViews,
      uniqueViews,
      tipsReceived: earnings,
      tipCount: tipAgg._count,
      avgRating: reviewAgg._avg.rating ?? 0,
      reviewCount: reviewAgg._count,
      earnings,
      contacts,
    },
    deltas: {
      totalViews: calcGrowthPct(currentViews, previousViews),
      uniqueViews: calcGrowthPct(uniqueViews, previousUniqueViews),
      tipsReceived: calcGrowthPct(earnings, previousEarnings),
      avgRating: calcRatingDelta(reviewAgg._avg.rating, previousReviewAgg._avg.rating),
      earnings: calcGrowthPct(earnings, previousEarnings),
    },
    charts: {
      series,
      ratingDistribution: [5, 4, 3, 2, 1].map((rating) => {
        const item = ratingDistribution.find((r) => r.rating === rating)
        return { rating, count: item?._count.rating ?? 0 }
      }),
    },
  }
}

/**
 * Builds the full daily time-series for a worker's personal dashboard.
 * Each point contains views, unique views, tip totals, review averages, and earnings.
 *
 * Used directly by `getWorkerPersonalDashboard` and independently by
 * `GET /api/workers/:id/analytics/dashboard` when only the chart is needed.
 */
export async function getWorkerDashboardSeries(
  workerId: string,
  range: Required<DateRange>,
): Promise<TimeSeriesPoint[]> {
  const worker = await db.worker.findUnique({ where: { id: workerId }, select: { id: true } })
  if (!worker) throw new AppError('Worker not found', 404)

  const [views, tips, reviews] = await Promise.all([
    db.profileView.findMany({
      where: { workerId, viewedAt: dateRangeWhere(range) },
      select: { viewedAt: true, ip: true },
      orderBy: { viewedAt: 'asc' },
    }),
    db.workerTipEvent.findMany({
      where: { workerId, createdAt: dateRangeWhere(range) },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    db.review.findMany({
      where: { workerId, status: 'approved', createdAt: dateRangeWhere(range) },
      select: { rating: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const dailyMap = buildDailyMap(range)

  // Accumulate total views
  for (const view of views) {
    const key = dayKey(view.viewedAt)
    const point = dailyMap.get(key)
    if (point) point.views += 1
  }

  // Accumulate unique views (distinct IPs per day)
  const uniqueIpsByDay = new Map<string, Set<string>>()
  for (const view of views) {
    const key = dayKey(view.viewedAt)
    if (!uniqueIpsByDay.has(key)) uniqueIpsByDay.set(key, new Set())
    uniqueIpsByDay.get(key)!.add(view.ip)
  }
  for (const [key, ips] of uniqueIpsByDay) {
    const point = dailyMap.get(key)
    if (point) point.uniqueViews = ips.size
  }

  // Accumulate tip totals
  for (const tip of tips) {
    const key = dayKey(tip.createdAt)
    const point = dailyMap.get(key)
    if (point) {
      point.tips += tip.amount
      point.earnings += tip.amount
      point.tipCount += 1
    }
  }

  // Accumulate review averages
  const ratingsByDay = new Map<string, number[]>()
  for (const review of reviews) {
    const key = dayKey(review.createdAt)
    if (!ratingsByDay.has(key)) ratingsByDay.set(key, [])
    ratingsByDay.get(key)!.push(review.rating)
  }
  for (const [key, ratings] of ratingsByDay) {
    const point = dailyMap.get(key)
    if (point) {
      point.reviewCount = ratings.length
      point.avgRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length
    }
  }

  return Array.from(dailyMap.values())
}
