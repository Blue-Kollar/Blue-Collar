import { z } from 'zod'
import { nameField, phoneField } from './shared.js'

/**
 * User validation schemas for the API.
 * Core schemas are imported from @bluecollar/types to stay in sync with the App.
 */

export {
  changePasswordSchema as changePasswordRules,
} from '@bluecollar/types'

/**
 * Sanitised free-text field.
 * Strips HTML tags / script payloads and trims whitespace before length checks
 * so stored and displayed values cannot carry markup.
 */
export const sanitisedTextField = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((value) =>
      value
        // Remove script/style blocks including their contents
        .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        // Remove any remaining HTML tags
        .replace(/<[^>]*>/g, '')
        // Decode nothing; strip control characters
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
        .trim(),
    )
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`),
    )

/**
 * API-specific update profile rules.
 * Overrides the shared schema so free-text fields (firstName, lastName, bio)
 * are sanitised and length-bounded before storage.
 */
export const updateProfileRules = z.object({
  firstName: sanitisedTextField(1, 50, 'First name').optional(),
  lastName: sanitisedTextField(1, 50, 'Last name').optional(),
  bio: sanitisedTextField(0, 500, 'Bio').optional(),
  phone: phoneField.optional(),
})

// POST /users/me/push-subscription — API-only
export const pushSubscriptionRules = z.object({
  endpoint: z.string().url('Must be a valid URL'),
  keys: z.object({
    auth: z.string().min(1),
    p256dh: z.string().min(1),
  }),
})

// DELETE /users/me/push-subscription — API-only
export const deletePushSubscriptionRules = z.object({
  endpoint: z.string().url('Must be a valid URL'),
})

// POST /users/onboarding/complete — API-only, no body fields required
export const completeOnboardingRules = z.object({})