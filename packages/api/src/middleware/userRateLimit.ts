/**
 * @deprecated Use the consolidated factory in `rateLimit.ts` (Issue #1637).
 *
 * This module is kept only as a compatibility shim. All rate limiting is now
 * created from a named policy via `createRateLimiter`, so limiters share one
 * implementation and one configuration source.
 */

import { createRateLimiter } from './rateLimit.js'
import { CONTACT, GENERAL_API } from '@/config/rateLimits.js'

/** Contact request limiter: 5/hour for authenticated users, 1/hour anon. */
export const contactRateLimit = createRateLimiter(CONTACT)

/** General API limiter: 200/15min for authenticated users, 60/15min anon. */
export const generalRateLimit = createRateLimiter(GENERAL_API)
