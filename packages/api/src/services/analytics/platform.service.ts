/**
 * Platform-wide analytics — admin KPI dashboard.
 *
 * Covers:
 *   - Aggregate counts (workers, users, curators, reviews, contacts, views)
 *   - Month-over-month growth percentages
 *   - Monthly growth trend series (N months back)
 *   - Top-categories leaderboard
 *   - Recent workers / recent users lists
 */
import { db } from '../../db.js'
import { daysAgo, calcGrowthPct } from './shared.js'

// ── Monthly growth trend ─────────────────────────────────────────────────────

/**
 * Returns an array of { month, count } objects covering the last `months`
 * calendar months for either the `user` or `worker` table.
 * The first element is the oldest month; the last is the current month.
 *
 * @internal Used by getPlatformAnalytics; not exported from the barrel.
 */
async function getGrowthData(model: 'user' | 'worker', months: number) {
  const data: { month: string; count: number }[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const label = start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

    const count =
      model === 'user'
        ? await db.user.count({ where: { createdAt: { gte: start, lt: end } } })
        : await db.worker.count({ where: { createdAt: { gte: start, lt: end } } })

    data.push({ month: label, count })
  }

  return data
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Returns the full platform analytics payload consumed by
 * `GET /api/analytics/platform` and the admin dashboard.
 *
 * Shape:
 *   { overview, engagement, revenue, growth, trends, topCategories, recentWorkers, recentUsers }
 */
export async function getPlatformAnalytics() {
  const thirtyDaysAgo = daysAgo(30)
  const sixtyDaysAgo = daysAgo(60)

  const [
    totalWorkers,
    activeWorkers,
    totalUsers,
    totalCurators,
    workersThisMonth,
    workersLastMonth,
    usersThisMonth,
    usersLastMonth,
    totalViews,
    viewsThisMonth,
    totalReviews,
    reviewsThisMonth,
    totalContacts,
    contactsThisMonth,
    topCategories,
    recentWorkers,
    recentUsers,
    tipAgg,
    userGrowth,
    workerGrowth,
  ] = await Promise.all([
    db.worker.count(),
    db.worker.count({ where: { isActive: true } }),
    db.user.count(),
    db.user.count({ where: { role: 'curator' } }),
    db.worker.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.worker.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.profileView.count(),
    db.profileView.count({ where: { viewedAt: { gte: thirtyDaysAgo } } }),
    db.review.count(),
    db.review.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.contactRequest.count(),
    db.contactRequest.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.category.findMany({
      select: { id: true, name: true, _count: { select: { workers: true } } },
      orderBy: { workers: { _count: 'desc' } },
      take: 10,
    }),
    db.worker.findMany({
      select: { id: true, name: true, createdAt: true, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, role: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.workerAnalytics.aggregate({
      _sum: { totalTips: true, tipCount: true },
    }),
    getGrowthData('user', 6),
    getGrowthData('worker', 6),
  ])

  return {
    overview: {
      totalWorkers,
      activeWorkers,
      totalUsers,
      totalCurators,
    },
    engagement: {
      totalViews,
      viewsThisMonth,
      totalReviews,
      reviewsThisMonth,
      totalContacts,
      contactsThisMonth,
    },
    revenue: {
      totalTips: tipAgg._sum.totalTips ?? 0,
      totalTipCount: tipAgg._sum.tipCount ?? 0,
    },
    growth: {
      workersThisMonth,
      workersLastMonth,
      workerGrowthPct: calcGrowthPct(workersThisMonth, workersLastMonth),
      usersThisMonth,
      usersLastMonth,
      userGrowthPct: calcGrowthPct(usersThisMonth, usersLastMonth),
    },
    trends: {
      userGrowth,
      workerGrowth,
    },
    topCategories: topCategories.map((cat) => ({
      name: cat.name,
      count: cat._count.workers,
    })),
    recentWorkers,
    recentUsers,
  }
}
