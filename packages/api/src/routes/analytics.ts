import { Router } from 'express'
import {
  getCuratorDashboard,
  getPlatformDashboard,
  getTopWorkers,
  exportCuratorCsv,
  exportPlatformCsv,
  getProtocolMetrics,
  getProtocolMetricsTimeSeries,
  getAdminDashboard,
  exportAdminCsv,
} from '../controllers/analytics.js'
import { recordEvents } from '../controllers/analyticsEvents.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { cacheMiddleware, CacheTTL } from '../middleware/cache.js'

const router = Router()

// Public event tracking (no auth required)
router.post('/events', recordEvents)

router.use(authenticate)

// Curator analytics
router.get('/curator', authorize('curator', 'admin'), cacheMiddleware(CacheTTL.SHORT), getCuratorDashboard)
router.get('/export/curator', authorize('curator', 'admin'), exportCuratorCsv)

// Admin platform analytics
router.get('/platform', authorize('admin'), cacheMiddleware(CacheTTL.SHORT), getPlatformDashboard)
router.get('/export/platform', authorize('admin'), exportPlatformCsv)
router.get('/admin/dashboard', authorize('admin'), cacheMiddleware(CacheTTL.SHORT), getAdminDashboard)
router.get('/admin/export', authorize('admin'), exportAdminCsv)

// Protocol health metrics (public/authenticated)
router.get('/metrics', cacheMiddleware(CacheTTL.SHORT), getProtocolMetrics)
router.get('/metrics/timeseries', cacheMiddleware(CacheTTL.SHORT), getProtocolMetricsTimeSeries)

// Leaderboard (authenticated users)
router.get('/top-workers', cacheMiddleware(CacheTTL.SHORT), getTopWorkers)

export default router
