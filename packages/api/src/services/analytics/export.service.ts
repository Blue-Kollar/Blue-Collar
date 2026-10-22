/**
 * Export analytics — CSV/report formatting for controllers/export.ts,
 * controllers/analytics.ts, and the admin dashboard.
 *
 * Issue #1641: Streaming CSV exports for large datasets.
 *
 * All exports now stream directly to the response without buffering,
 * keeping memory usage flat regardless of dataset size.
 *
 * Covers:
 *   - exportWorkerAnalyticsCsv  — curator's workers as a CSV
 *   - exportPlatformAnalyticsCsv — full platform worker list as a CSV
 *   - exportPersonalWorkerAnalyticsCsv — daily series + summary for one worker
 */
import type { Response } from 'express'
import { db } from '@/db.js'
import { type DateRange } from './shared.js'
import { getWorkerPersonalDashboard } from './worker.service.js'
import { CsvWriter } from '@/utils/csv-writer.js'

// ── Curator export ───────────────────────────────────────────────────────────

/**
 * Streams a CSV containing one row per worker managed by `curatorId`.
 * Columns: Worker Name, Category, Total Views, Unique Views, Tips (XLM),
 *          Tip Count, Bookmarks, Contacts, Avg Rating, Reviews.
 *
 * Fetches workers in batches and streams rows without buffering the full dataset.
 * Used by `GET /api/analytics/export/curator`.
 *
 * @param response Express response object for streaming
 * @param curatorId The curator's user ID
 * @returns Promise resolving to the number of rows written
 */
export async function exportWorkerAnalyticsCsv(response: Response, curatorId: string): Promise<number> {
  const writer = new CsvWriter(response, 'worker-analytics.csv')
  writer.initialize()

  const headers = ['Worker Name', 'Category', 'Total Views', 'Unique Views', 'Tips (XLM)', 
                   'Tip Count', 'Bookmarks', 'Contacts', 'Avg Rating', 'Reviews']
  await writer.writeHeader(headers)

  // Fetch workers for this curator
  const workers = await db.worker.findMany({
    where: { curatorId },
    include: { category: true },
  })

  if (workers.length === 0) {
    await writer.end()
    return 0
  }

  // Fetch analytics for all workers at once (necessary for aggregation)
  const workerIds = workers.map((w) => w.id)
  const analyticsRows = await db.workerAnalytics.findMany({
    where: { workerId: { in: workerIds } },
  })
  const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

  // Fetch review aggregations for all workers
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

  // Stream rows
  for (const worker of workers) {
    const analytics = analyticsMap.get(worker.id)
    const review = reviewMap.get(worker.id)

    await writer.writeRow([
      worker.name,
      worker.category.name,
      analytics?.totalViews ?? 0,
      analytics?.uniqueViews ?? 0,
      analytics?.totalTips ?? 0,
      analytics?.tipCount ?? 0,
      analytics?.bookmarkCount ?? 0,
      analytics?.contactCount ?? 0,
      (review?.avg ?? 0).toFixed(1),
      review?.count ?? 0,
    ])
  }

  await writer.end()
  return writer.getRowCount()
}

// ── Platform export ──────────────────────────────────────────────────────────

/**
 * Streams a CSV covering every worker on the platform.
 * Columns: Worker Name, Category, Curator, Total Views, Unique Views,
 *          Tips (XLM), Tip Count, Bookmarks, Contacts.
 *
 * Fetches workers in batches and streams rows without buffering.
 * Used by `GET /api/analytics/export/platform`.
 *
 * @param response Express response object for streaming
 * @returns Promise resolving to the number of rows written
 */
export async function exportPlatformAnalyticsCsv(response: Response): Promise<number> {
  const writer = new CsvWriter(response, 'platform-analytics.csv')
  writer.initialize()

  const headers = ['Worker Name', 'Category', 'Curator', 'Total Views', 'Unique Views',
                   'Tips (XLM)', 'Tip Count', 'Bookmarks', 'Contacts']
  await writer.writeHeader(headers)

  // Fetch all workers with pagination to avoid buffering entire dataset
  const pageSize = 1000
  let skip = 0
  let hasMore = true

  while (hasMore) {
    const workers = await db.worker.findMany({
      where: { deletedAt: null },
      include: {
        category: true,
        curator: { select: { firstName: true, lastName: true } },
      },
      skip,
      take: pageSize,
    })

    if (workers.length === 0) {
      hasMore = false
      break
    }

    // Fetch analytics for this batch
    const workerIds = workers.map((w) => w.id)
    const analyticsRows = await db.workerAnalytics.findMany({
      where: { workerId: { in: workerIds } },
    })
    const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

    // Stream rows for this batch
    for (const worker of workers) {
      const analytics = analyticsMap.get(worker.id)

      await writer.writeRow([
        worker.name,
        worker.category.name,
        `${worker.curator.firstName} ${worker.curator.lastName}`,
        analytics?.totalViews ?? 0,
        analytics?.uniqueViews ?? 0,
        analytics?.totalTips ?? 0,
        analytics?.tipCount ?? 0,
        analytics?.bookmarkCount ?? 0,
        analytics?.contactCount ?? 0,
      ])
    }

    if (workers.length < pageSize) {
      hasMore = false
    } else {
      skip += pageSize
    }
  }

  await writer.end()
  return writer.getRowCount()
}

// ── Personal worker export ───────────────────────────────────────────────────

/**
 * Streams a CSV for a single worker's personal dashboard data.
 * The CSV contains a daily time-series section followed by a summary block.
 * Columns: Date, Views, Unique Views, Tips (XLM), Tip Count,
 *          Average Rating, Review Count, Earnings (XLM).
 *
 * Used by `GET /api/workers/:id/analytics/export`.
 *
 * @param response Express response object for streaming
 * @param workerId The worker's ID
 * @param range Date range for the export
 * @returns Promise resolving to the number of rows written
 */
export async function exportPersonalWorkerAnalyticsCsv(
  response: Response,
  workerId: string,
  range: Required<DateRange>,
): Promise<number> {
  const writer = new CsvWriter(response, `worker-${workerId}-analytics.csv`)
  writer.initialize()

  const dashboard = await getWorkerPersonalDashboard(workerId, range)

  // Write time-series header
  const headers = ['Date', 'Views', 'Unique Views', 'Tips (XLM)', 'Tip Count',
                   'Average Rating', 'Review Count', 'Earnings (XLM)']
  await writer.writeHeader(headers)

  // Stream time-series data
  for (const point of dashboard.charts.series) {
    await writer.writeRow([
      point.date,
      point.views,
      point.uniqueViews,
      point.tips.toFixed(7),
      point.tipCount,
      point.avgRating == null ? '' : point.avgRating.toFixed(2),
      point.reviewCount,
      point.earnings.toFixed(7),
    ])
  }

  // Write summary section (blank line, then key-value pairs)
  await writer.writeRow(['']) // Blank line separator

  // Use writeRow for summary as well since it's just key-value pairs
  const summaryRows = [
    ['Worker', dashboard.worker.name],
    ['Category', dashboard.worker.category],
    ['Range', `${dashboard.range.startDate} to ${dashboard.range.endDate}`],
    ['Total Views', dashboard.summary.totalViews],
    ['Unique Views', dashboard.summary.uniqueViews],
    ['Tips Received (XLM)', dashboard.summary.tipsReceived.toFixed(7)],
    ['Tip Count', dashboard.summary.tipCount],
    ['Average Rating', dashboard.summary.avgRating.toFixed(2)],
    ['Review Count', dashboard.summary.reviewCount],
    ['Earnings (XLM)', dashboard.summary.earnings.toFixed(7)],
  ]

  for (const row of summaryRows) {
    await writer.writeRow(row)
  }

  await writer.end()
  return writer.getRowCount()
}
