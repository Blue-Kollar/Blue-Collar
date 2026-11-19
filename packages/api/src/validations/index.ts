/**
 * Central export for all validation schemas.
 *
 * Shared schemas now live in `@bluecollar/types` so the frontend and API
 * validate against a single source of truth. This module re-exports the
 * shared rules under their existing `*Rules` names so route imports do not
 * change, and keeps API-specific concerns (sanitised free-text fields,
 * push-subscription rules, etc.) local.
 *
 * Usage:
 *   import { loginRules, createWorkerRules } from '@/validations/index.js'
 *   router.post('/login', validate(loginRules), login)
 */

// ---------------------------------------------------------------------------
// Shared schemas (single source of truth in @bluecollar/types)
// ---------------------------------------------------------------------------
export {
  // shared
  idRules,
  paginationRules,
  emailRules,
  phoneRules,
  passwordRules,
  // auth
  loginRules,
  registerRules,
  refreshTokenRules,
  forgotPasswordRules,
  resetPasswordRules,
  changePasswordRules,
  // user
  updateProfileRules,
  updateUserRules,
  createUserRules,
  // booking
  createBookingRules,
  updateBookingRules,
  bookingStatusRules,
  // job
  createJobRules,
  updateJobRules,
  jobStatusRules,
  // payment
  createPaymentRules,
  updatePaymentRules,
  refundRules,
  // wallet
  walletTopUpRules,
  walletWithdrawRules,
  walletTransferRules,
  // device
  registerDeviceRules,
  updateDeviceRules,
  // admin
  adminLoginRules,
  adminUserRules,
} from '@bluecollar/types'

// ---------------------------------------------------------------------------
// API-specific schemas (not shared with the frontend)
// ---------------------------------------------------------------------------
export * from './worker.js'
export * from './pushSubscription.js'
export * from './sanitizedText.js'
