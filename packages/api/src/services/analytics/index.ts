/**
 * Barrel re-export for the analytics sub-modules.
 *
 * Controllers and other consumers that previously imported from
 * `../services/analytics.service.js` can continue to do so without
 * modification — `analytics.service.ts` now re-exports everything from here.
 *
 * If you need only a focused subset (e.g., just revenue helpers), import
 * directly from the relevant sub-module:
 *
 *   import { getRevenueMetrics } from './analytics/revenue.service.js'
 */

// Platform-wide KPIs
export { getPlatformAnalytics } from './platform.service.js'

// Worker engagement / recording
export {
  assertCanAccessWorkerAnalytics,
  getCuratorAnalytics,
  getTopWorkers,
  getWorkerAnalytics,
  getWorkerDashboardSeries,
  getWorkerPersonalDashboard,
  getWorkerViewTrends,
  parseAnalyticsDateRange,
  recordContact,
  recordProfileView,
  recordTip,
  updateBookmarkCount,
} from './worker.service.js'

// Revenue / escrow aggregation
export type { DateRangeFilter } from './revenue.service.js'
export { getDisputeMetrics,getRevenueMetrics } from './revenue.service.js'

// CSV / report formatting
export {
  exportPersonalWorkerAnalyticsCsv,
  exportPlatformAnalyticsCsv,
  exportWorkerAnalyticsCsv,
} from './export.service.js'

// Shared types (useful for external consumers)
export type { DateRange, TimeSeriesPoint } from './shared.js'
