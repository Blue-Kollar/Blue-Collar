/**
 * Re-export the shared sanitisation helpers for service/controller write paths.
 * The implementation lives in `middleware/sanitize.ts` so the request
 * middleware and direct service calls use exactly the same rules.
 */
export {
  sanitizeText,
  sanitizeFreeText,
  sanitizeObject,
  sanitizeValue,
  sanitize,
  sanitizeBody,
  sanitizeParams,
} from '@/middleware/sanitize.js'

/** Backwards-compatible alias for {@link sanitizeText}. */
export { sanitizeText as sanitizeString } from '@/middleware/sanitize.js'
