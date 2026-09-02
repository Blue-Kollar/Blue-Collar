/**
 * Central export for all validation schemas.
 *
 * All schemas use Zod. Import from here to avoid reaching into individual files.
 *
 * Usage:
 *   import { loginRules, createWorkerRules } from '../validations/index.js'
 *   router.post('/login', validate(loginRules), login)
 */
export * from './admin.js'
export * from './auth.js'
export * from './booking.js'
export * from './device.js'
export * from './job.js'
export * from './payment.js'
export * from './shared.js'
export * from './user.js'
export * from './wallet.js'
export * from './worker.js'
