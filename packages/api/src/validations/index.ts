/**
 * Central export for all validation schemas.
 *
 * Issue #1894 — Barrel export cleanup:
 * This barrel intentionally re-exports shared Zod schemas from
 * `@bluecollar/types` under their `*Rules` route aliases so that:
 *   1. Route handlers import from one stable path (`@/validations/index.js`)
 *   2. The types package remains the single source of truth for schema logic
 *   3. Direct deep imports into `@bluecollar/types` internals are avoided
 *
 * When adding new shared schemas, add them to `@bluecollar/types/validations`
 * first, then re-export the alias here. API-only schemas (sanitisation, push
 * subscriptions) stay in their own files and are exported directly below.
 *
 * Usage:
 *   import { loginRules, createWorkerRules } from '@/validations/index.js'
 *   router.post('/login', validate(loginRules), login)
 */

// ---------------------------------------------------------------------------
// Shared schemas — aliased from @bluecollar/types (single source of truth)
// The *Schema names from @bluecollar/types are re-exported as *Rules so that
// route files do not need to change when schemas are refactored.
// ---------------------------------------------------------------------------
export {
  // primitives
  emailField as emailRules,
  passwordField as passwordRules,
  phoneField as phoneRules,
  // auth
  loginSchema as loginRules,
  registerSchema as registerRules,
  forgotPasswordSchema as forgotPasswordRules,
  resetPasswordSchema as resetPasswordRules,
  verifyAccountSchema as verifyAccountRules,
  resendVerificationSchema as resendVerificationRules,
  changePasswordSchema as changePasswordRules,
  // user
  updateProfileSchema as updateProfileRules,
  // booking
  createBookingSchema as createBookingRules,
  listBookingsSchema as updateBookingRules,
  updateBookingStatusSchema as bookingStatusRules,
  // job
  createJobSchema as createJobRules,
  updateJobSchema as updateJobRules,
  listJobsSchema as jobStatusRules,
  // wallet
  linkWalletSchema as linkWalletRules,
  buildTransactionSchema as buildTxRules,
  broadcastTransactionSchema as broadcastRules,
  fundWalletSchema as fundTestnetRules,
  // device
  revokeDeviceSchema as revokeDeviceRules,
  // admin
  adminBulkActionSchema as adminUserRules,
} from '@bluecollar/types'

// Also export the schema names directly for callers that prefer the canonical names
export {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyAccountSchema,
  resendVerificationSchema,
  changePasswordSchema,
  updateProfileSchema,
  createWorkerSchema as createWorkerRules,
  updateWorkerSchema as updateWorkerRules,
  createReviewSchema as createReviewRules,
  createBookingSchema,
  updateBookingStatusSchema,
  createJobSchema,
  updateJobSchema,
  listJobsSchema,
  applyToJobSchema,
  updateApplicationStatusSchema,
  linkWalletSchema,
  buildTransactionSchema,
  broadcastTransactionSchema,
  fundWalletSchema,
  revokeDeviceSchema,
  adminBulkActionSchema,
  tipPaymentSchema,
  escrowPaymentSchema,
} from '@bluecollar/types'

// ---------------------------------------------------------------------------
// API-specific schemas (not shared with the frontend)
// ---------------------------------------------------------------------------
export * from './worker.js'
export * from './pushSubscription.js'
export * from './sanitizedText.js'
