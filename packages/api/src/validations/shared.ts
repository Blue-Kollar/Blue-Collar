/**
 * Shared primitive validation fields.
 * These are re-exported from @bluecollar/types so that both the API and App
 * use identical rules. Extend here only for API-specific concerns.
 */
export {
  emailField,
  passwordField,
  nameField,
  tokenField,
  phoneField,
  stellarAddressField,
} from '@bluecollar/types'
