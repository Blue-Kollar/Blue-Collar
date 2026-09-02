/**
 * Auth validation schemas for the API.
 * Core schemas are imported from @bluecollar/types to stay in sync with the App.
 */
export {
  forgotPasswordSchema as forgotPasswordRules,
  loginSchema as loginRules,
  registerSchema as registerRules,
  resendVerificationSchema as resendVerificationRules,
  resetPasswordSchema as resetPasswordRules,
  verifyAccountSchema as verifyAccountRules,
} from '@bluecollar/types'
