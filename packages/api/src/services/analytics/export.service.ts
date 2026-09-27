/**
 * Export analytics — CSV/report formatting for controllers/export.ts,
 * controllers/analytics.ts, and the admin dashboard.
 *
 * Covers:
 *   - exportWorkerAnalyticsCsv  — curator's workers as a CSV
 *   - exportPlatformAnalyticsCsv — full platform worker list as a CSV
 *   - exportPersonalWorkerAnalyticsCsv — daily series + summary for one worker
 */
import { db } from '../../db.js'
import { type DateRange, csvEscape } from './shared.js'
import { getWorkerPersonalDashboard } from './worker.service.js'

// ── Curator export ───────────────────────────────────────────────────────────

/**
 * Builds a CSV string containing one row per worker managed by `curatorId`.
 * Columns: Worker Name, Category, Total Views, Unique Views, Tips (XLM),
 *          Tip Count, Bookmarks, Contacts, Avg Rating, Reviews.
 *
 * Used by `GET /api/analytics/export/curator`.
 */
export async function exportWorkerAnalyticsCsv(curatorId: string): Promise<string> {
  const workers = await db.worker.findMany({
    where: { curatorId },
    include: { category: true },
  })

  const workerIds = workers.map((w) => w.id)
  const analyticsRows = await db.workerAnalytics.findMany({
    where: { workerId: { in: workerIds } },
  })
  const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

  const reviewAggs = await Promise.all(
    workerIds.map(async (id) => {
      const agg = await db.review.aggregate({
        where: { workerId: id, status: 'approved' },
        _avg: { rating: true },
        _count: true,
      })
      return { id, avg: agg._avg.rating ?? 0, count: agg._count }
    }),
  )
  const reviewMap = new Map(reviewAggs.map((r) => [r.id, r]))

  const header =
    'Worker Name,Category,Total Views,Unique Views,Tips (XLM),Tip Count,Bookmarks,Contacts,Avg Rating,Reviews'
  const rows = workers.map((w) => {
    const a = analyticsMap.get(w.id)
    const r = reviewMap.get(w.id)
    return [
      csvEscape(w.name),
      csvEscape(w.category.name),
      a?.totalViews ?? 0,
      a?.uniqueViews ?? 0,
      a?.totalTips ?? 0,
      a?.tipCount ?? 0,
      a?.bookmarkCount ?? 0,
      a?.contactCount ?? 0,
      (r?.avg ?? 0).toFixed(1),
      r?.count ?? 0,
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

// ── Platform export ──────────────────────────────────────────────────────────

/**
 * Builds a CSV string covering every worker on the platform.
 * Columns: Worker Name, Category, Curator, Total Views, Unique Views,
 *          Tips (XLM), Tip Count, Bookmarks, Contacts.
 *
 * Used by `GET /api/analytics/export/platform`.
 */
export async function exportPlatformAnalyticsCsv(): Promise<string> {
  const workers = await db.worker.findMany({
    include: {
      category: true,
      curator: { select: { firstName: true, lastName: true } },
    },
  })

  const workerIds = workers.map((w) => w.id)
  const analyticsRows = await db.workerAnalytics.findMany({
    where: { workerId: { in: workerIds } },
  })
  const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

  const header =
    'Worker Name,Category,Curator,Total Views,Unique Views,Tips (XLM),Tip Count,Bookmarks,Contacts'
  const rows = workers.map((w) => {
    const a = analyticsMap.get(w.id)
    return [
      csvEscape(w.name),
      csvEscape(w.category.name),
      csvEscape(`${w.curator.firstName} ${w.curator.lastName}`),
      a?.totalViews ?? 0,
      a?.uniqueViews ?? 0,
      a?.totalTips ?? 0,
      a?.tipCount ?? 0,
      a?.bookmarkCount ?? 0,
      a?.contactCount ?? 0,
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

// ── Personal worker export ───────────────────────────────────────────────────

/**
 * Builds a CSV string for a single worker's personal dashboard data.
 * The CSV contains a daily time-series section followed by a summary block.
 * Columns: Date, Views, Unique Views, Tips (XLM), Tip Count,
 *          Average Rating, Review Count, Earnings (XLM).
 *
 * Used by `GET /api/workers/:id/analytics/export`.
 */
export async function exportPersonalWorkerAnalyticsCsv(
  workerId: string,
  range: Required<DateRange>,
): Promise<string> {
  const dashboard = await getWorkerPersonalDashboard(workerId, range)

  const lines = [
    'Date,Views,Unique Views,Tips (XLM),Tip Count,Average Rating,Review Count,Earnings (XLM)',
    ...dashboard.charts.series.map((p) =>
      [
        p.date,
        p.views,
        p.uniqueViews,
        p.tips.toFixed(7),
        p.tipCount,
        p.avgRating == null ? '' : p.avgRating.toFixed(2),
        p.reviewCount,
        p.earnings.toFixed(7),
      ].join(','),
    ),
    '',
    `Worker,${csvEscape(dashboard.worker.name)}`,
    `Category,${csvEscape(dashboard.worker.category)}`,
    `Range,${dashboard.range.startDate} to ${dashboard.range.endDate}`,
    `Total Views,${dashboard.summary.totalViews}`,
    `Unique Views,${dashboard.summary.uniqueViews}`,
    `Tips Received (XLM),${dashboard.summary.tipsReceived.toFixed(7)}`,
    `Tip Count,${dashboard.summary.tipCount}`,
    `Average Rating,${dashboard.summary.avgRating.toFixed(2)}`,
    `Review Count,${dashboard.summary.reviewCount}`,
    `Earnings (XLM),${dashboard.summary.earnings.toFixed(7)}`,
  ]

  return lines.join('\n')
}
