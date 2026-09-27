import { db as defaultDb } from '../db.js'
import { sendVerificationEmail, sendPasswordResetEmail } from '../mailer/index.js'
import { userRepository as defaultUserRepository } from '../repositories/user.repository.js'
import type { AuthServiceDeps } from '../container/types.js'
import type { LoginBody, RegisterBody } from '../interfaces/index.js'
import { createAuthSessionService, generateRefreshToken } from './auth-session.service.js'
import { createAuthRecoveryService, generateVerificationToken } from './auth-recovery.service.js'
import * as auth2FA from './auth-2fa.service.js'

export { generateRefreshToken, generateVerificationToken }
export { createAuthSessionService, createAuthRecoveryService }
export const generateTOTPSecret = auth2FA.generateTOTPSecret
export const enableTwoFactorAuth = auth2FA.enableTwoFactorAuth
export const verifyTOTPCode = auth2FA.verifyTOTPCode
export const disableTwoFactorAuth = auth2FA.disableTwoFactorAuth

/**
 * Create an auth service with injected dependencies.
 */
export function createAuthService(deps: AuthServiceDeps) {
  const session = createAuthSessionService(deps)
  const recovery = createAuthRecoveryService(deps)

  return {
    loginUser: session.loginUser,
    rotateRefreshToken: session.rotateRefreshToken,
    revokeAllRefreshTokens: session.revokeAllRefreshTokens,
    registerUser: recovery.registerUser,
    verifyAccount: recovery.verifyAccount,
    resendVerificationEmail: recovery.resendVerificationEmail,
    requestPasswordReset: recovery.requestPasswordReset,
    resetPassword: recovery.resetPassword,
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createAuthService({
  userRepository: defaultUserRepository,
  mailer: { sendVerificationEmail, sendPasswordResetEmail },
  db: defaultDb,
})

export async function loginUser(
  body: LoginBody,
  deviceName?: string,
  userAgent?: string,
  ipAddress?: string,
) {
  return _defaultService.loginUser(body, deviceName, userAgent, ipAddress)
}

export async function rotateRefreshToken(rawToken: string) {
  return _defaultService.rotateRefreshToken(rawToken)
}

export async function revokeAllRefreshTokens(userId: string) {
  return _defaultService.revokeAllRefreshTokens(userId)
}

export async function registerUser(body: RegisterBody) {
  return _defaultService.registerUser(body)
}

export async function verifyAccount(token: string): Promise<boolean> {
  return _defaultService.verifyAccount(token)
}

export async function resendVerificationEmail(email: string) {
  return _defaultService.resendVerificationEmail(email)
}

export async function requestPasswordReset(email: string) {
  return _defaultService.requestPasswordReset(email)
}

export async function resetPassword(token: string, password: string) {
  return _defaultService.resetPassword(token, password)
}
