/**
 * analytics.service.ts — backwards-compatible re-export shim.
 *
 * The analytics domain has been refactored into focused sub-modules
 * under `services/analytics/`:
 *
 *   platform.service.ts  — platform-wide KPIs (users, workers, growth)
 *   worker.service.ts    — per-worker engagement, views, recording helpers
 *   revenue.service.ts   — fee/tip/escrow revenue aggregation
 *   export.service.ts    — CSV/report formatting
 *   shared.ts            — pure date/math/CSV helpers
 *   index.ts             — barrel re-export (this file delegates here)
 *
 * All existing imports from `../services/analytics.service.js` continue to
 * resolve correctly via this shim.  New code should import from the specific
 * sub-module or from `./analytics/index.js` directly.
 *
 * Closes #933
 */
export * from './analytics/index.js'
