/**
 * Auth validation schemas for the API.
 * Core schemas are imported from @bluecollar/types to stay in sync with the App.
 */
export {
  loginSchema as loginRules,
  registerSchema as registerRules,
  forgotPasswordSchema as forgotPasswordRules,
  resetPasswordSchema as resetPasswordRules,
  verifyAccountSchema as verifyAccountRules,
  resendVerificationSchema as resendVerificationRules,
} from '@bluecollar/types'
