/**
 * Revenue analytics — fee/tip/escrow aggregation.
 *
 * Re-exports the revenue-oriented repository functions from
 * `analytics.repository.ts` so callers can import from a single
 * domain-focused module rather than reaching into the repository layer directly.
 *
 * Covers:
 *   - `getRevenueMetrics` — total tips and transaction counts for a date range
 *   - `getDisputeMetrics` — dispute counts and resolution rates
 */
export {
  getRevenueMetrics,
  getDisputeMetrics,
  type DateRangeFilter,
} from '../../repositories/analytics.repository.js'
