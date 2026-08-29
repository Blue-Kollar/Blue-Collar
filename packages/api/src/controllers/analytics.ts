import type { Request, Response } from 'express'
import * as analyticsService from '../services/analytics.service.js'
import * as metricsService from '../services/metrics.service.js'
import * as analyticsRepo from '../repositories/analytics.repository.js'
import { handleError } from '../utils/handleError.js'

function routeId(req: Request): string {
  return String(req.params.id)
}

/** GET /api/workers/:id/analytics — curator or admin only */
export async function getAnalytics(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const data = await analyticsService.getWorkerAnalytics(routeId(req))
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** POST /api/workers/:id/analytics/view — public, records a profile view */
export async function trackView(req: Request, res: Response) {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown'
    await analyticsService.recordProfileView(routeId(req), ip)
    return res.json({ status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/workers/:id/analytics/trends — view trends over N days */
export async function getViewTrends(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const days = Math.min(Number(req.query.days) || 30, 90)
    const data = await analyticsService.getWorkerViewTrends(routeId(req), days)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/workers/:id/analytics/dashboard — personal dashboard metrics */
export async function getWorkerPersonalDashboard(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const range = analyticsService.parseAnalyticsDateRange(req.query)
    const data = await analyticsService.getWorkerPersonalDashboard(routeId(req), range)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/workers/:id/analytics/export — CSV export for one worker */
export async function exportWorkerPersonalCsv(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const range = analyticsService.parseAnalyticsDateRange(req.query)
    const csv = await analyticsService.exportPersonalWorkerAnalyticsCsv(routeId(req), range)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="worker-${routeId(req)}-analytics.csv"`)
    return res.send(csv)
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/curator — curator's aggregated analytics */
export async function getCuratorDashboard(req: Request, res: Response) {
  try {
    const data = await analyticsService.getCuratorAnalytics(req.user!.id)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/platform — admin platform-wide analytics */
export async function getPlatformDashboard(req: Request, res: Response) {
  try {
    const data = await analyticsService.getPlatformAnalytics()
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/top-workers — leaderboard by metric */
export async function getTopWorkers(req: Request, res: Response) {
  try {
    const metric = (req.query.metric as string) || 'views'
    const validMetrics = ['views', 'tips', 'bookmarks', 'rating']
    const safeMetric = validMetrics.includes(metric) ? metric as 'views' | 'tips' | 'bookmarks' | 'rating' : 'views'
    const limit = Math.min(Number(req.query.limit) || 10, 50)
    const data = await analyticsService.getTopWorkers(safeMetric, limit)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/export/curator — CSV export of curator's worker analytics */
export async function exportCuratorCsv(req: Request, res: Response) {
  try {
    const csv = await analyticsService.exportWorkerAnalyticsCsv(req.user!.id)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="worker-analytics.csv"')
    return res.send(csv)
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/export/platform — CSV export of platform analytics (admin) */
export async function exportPlatformCsv(req: Request, res: Response) {
  try {
    const csv = await analyticsService.exportPlatformAnalyticsCsv()
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="platform-analytics.csv"')
    return res.send(csv)
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/metrics — protocol health metrics */
export async function getProtocolMetrics(req: Request, res: Response) {
  try {
    const data = await metricsService.getProtocolMetrics()
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/metrics/timeseries — protocol metrics time series */
export async function getProtocolMetricsTimeSeries(req: Request, res: Response) {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90)
    const data = await metricsService.getProtocolMetricsTimeSeries(days)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/admin/dashboard — admin dashboard aggregated metrics */
export async function getAdminDashboard(req: Request, res: Response) {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
    
    const [growth, engagement, revenue, disputes, topPerformers] = await Promise.all([
      analyticsRepo.getGrowthMetrics({ startDate, endDate }),
      analyticsRepo.getEngagementMetrics({ startDate, endDate }),
      analyticsRepo.getRevenueMetrics({ startDate, endDate }),
      analyticsRepo.getDisputeMetrics({ startDate, endDate }),
      analyticsRepo.getTopPerformers('tips', 10),
    ])

    return res.json({
      data: { growth, engagement, revenue, disputes, topPerformers },
      status: 'success',
      code: 200,
    })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/admin/export — CSV export with date filters (admin) */
export async function exportAdminCsv(req: Request, res: Response) {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined
    
    const [growth, engagement, revenue] = await Promise.all([
      analyticsRepo.getGrowthMetrics({ startDate, endDate }),
      analyticsRepo.getEngagementMetrics({ startDate, endDate }),
      analyticsRepo.getRevenueMetrics({ startDate, endDate }),
    ])

    const header = 'Metric,Value'
    const rows = [
      `New Users,${growth.newUsers}`,
      `New Workers,${growth.newWorkers}`,
      `New Reviews,${growth.newReviews}`,
      `Profile Views,${engagement.views}`,
      `Contact Requests,${engagement.contacts}`,
      `Bookmarks,${engagement.bookmarks}`,
      `Total Revenue (XLM),${revenue.totalRevenue}`,
      `Total Transactions,${revenue.totalTransactions}`,
    ]

    const csv = [header, ...rows].join('\n')
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="admin-analytics.csv"')
    return res.send(csv)
  } catch (err) {
    return handleError(res, err)
  }
}
