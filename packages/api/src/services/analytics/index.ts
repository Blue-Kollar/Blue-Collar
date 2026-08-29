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
  recordProfileView,
  recordTip,
  updateBookmarkCount,
  recordContact,
  assertCanAccessWorkerAnalytics,
  parseAnalyticsDateRange,
  getWorkerAnalytics,
  getCuratorAnalytics,
  getWorkerViewTrends,
  getWorkerPersonalDashboard,
  getWorkerDashboardSeries,
  getTopWorkers,
} from './worker.service.js'

// Revenue / escrow aggregation
export { getRevenueMetrics, getDisputeMetrics } from './revenue.service.js'
export type { DateRangeFilter } from './revenue.service.js'

// CSV / report formatting
export {
  exportWorkerAnalyticsCsv,
  exportPlatformAnalyticsCsv,
  exportPersonalWorkerAnalyticsCsv,
} from './export.service.js'

// Shared types (useful for external consumers)
export type { DateRange, TimeSeriesPoint } from './shared.js'
