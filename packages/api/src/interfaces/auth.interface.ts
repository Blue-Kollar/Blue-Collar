/**
 * #1291 — Consolidated auth body types.
 *
 * LoginBody / RegisterBody / ForgotPasswordBody / ResetPasswordBody mirror
 * the DTO types in @bluecollar/types.  Type aliases here keep all existing
 * internal imports (../interfaces) working without changes.
 */
export type {
  ForgotPasswordDTO as ForgotPasswordBody,
  LoginDTO as LoginBody,
  RegisterDTO as RegisterBody,
  ResetPasswordDTO as ResetPasswordBody,
} from '@bluecollar/types'
