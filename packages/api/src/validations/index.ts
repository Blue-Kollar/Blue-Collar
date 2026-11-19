/**
 * Central export for all validation schemas.
 *
 * All schemas use Zod. Import from here to avoid reaching into individual files.
 *
 * Usage:
 *   import { loginRules, createWorkerRules } from '@/validations/index.js'
 *   router.post('/login', validate(loginRules), login)
 */
export * from './shared.js'
export * from './auth.js'
export * from './worker.js'
export * from './admin.js'
export * from './user.js'
export * from './payment.js'
export * from './device.js'
export * from './job.js'
export * from './wallet.js'
export * from './booking.js'
export * from './dispute.js'
export * from './escrow.js'
export * from './review.js'
export * from './verification.js'
export * from './notification.js'
export * from './message.js'
export * from './category.js'
export * from './portfolio.js'
export * from './referral.js'
export * from './subscription.js'
export * from './webhook.js'