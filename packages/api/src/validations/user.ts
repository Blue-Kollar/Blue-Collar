/**
 * User validation schemas for the API.
 * Core schemas are imported from @bluecollar/types to stay in sync with the App.
 */
import { z } from 'zod'

export {
  updateProfileSchema as updateProfileRules,
  changePasswordSchema as changePasswordRules,
} from '@bluecollar/types'

// POST /users/me/push-subscription — API-only
export const pushSubscriptionRules = z.object({
  endpoint: z.string().url('Must be a valid URL'),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
})
