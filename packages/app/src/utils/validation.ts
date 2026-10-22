/**
 * Validation helpers for packages/app.
 *
 * All validation logic lives in the shared `@bluecollar/types` package so
 * both the API and the App use identical rules. This file re-exports
 * everything from there — import from `@/utils/validation` (or `@/utils`)
 * as you did before; no call-site changes are needed.
 *
 * To add a new shared rule, edit `packages/types/src/validations.ts`.
 */
export {
  EMAIL_REGEX,
  PHONE_REGEX,
  STELLAR_ADDRESS_REGEX,
  isValidEmail,
  validateEmail,
  isValidPassword,
  validatePassword,
  isRequired,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  isValidStellarAddress,
  validateStellarAddress,
  isValidPhone,
  validatePhone,
  validateAmount,
  validateMatch,
  validateUserProfile,
  validateEscrowForm,
  validateContactMessage,
} from '@bluecollar/types'
