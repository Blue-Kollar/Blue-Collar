import { sendVerificationEmail, sendPasswordResetEmail } from '@/mailer/index.js';
import { userRepository as defaultUserRepository } from '@/repositories/user.repository.js';
import type { AuthServiceDeps } from '@/container/types.js';
import type { LoginBody, RegisterBody } from '@/interfaces/index.js';
import { nowUtc, parseUtcDate, addUtcMs, formatUtcIso } from '@/utils/date.js';
import { createAuthSessionService, generateRefreshToken } from './auth-session.service.js';
import { createAuthRecoveryService, generateVerificationToken } from './auth-recovery.service.js';
import * as auth2FA from './auth-2fa.service.js';

export { generateRefreshToken, generateVerificationToken };
export { createAuthSessionService, createAuthRecoveryService };
export const generateTOTPSecret = auth2FA.generateTOTPSecret;
export const enableTwoFactorAuth = auth2FA.enableTwoFactorAuth;
export const verifyTOTPCode = auth2FA.verifyTOTPCode;
export const disableTwoFactorAuth = auth2FA.disableTwoFactorAuth;

/**
 * Create an auth service with injected dependencies.
 */
export function createAuthService(deps: AuthServiceDeps) {
  const session = createAuthSessionService(deps);
  const recovery = createAuthRecoveryService(deps);

  return {
    loginUser: session.loginUser,
    rotateRefreshToken: session.rotateRefreshToken,
    revokeAllRefreshTokens: session.revokeAllRefreshTokens,
    registerUser: recovery.registerUser,
    verifyAccount: recovery.verifyAccount,
    resendVerificationEmail: recovery.resendVerificationEmail,
    requestPasswordReset: recovery.requestPasswordReset,
    resetPassword: recovery.resetPassword,
    exchangeRefreshToken: session.rotateRefreshToken,
    handleOAuthCallback: session.handleOAuthCallback,
    completeVerificationFlow: recovery.verifyAccount,
    completePasswordResetFlow: recovery.resetPassword,
  };
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createAuthService({
  userRepository: defaultUserRepository,
  mailer: { sendVerificationEmail, sendPasswordResetEmail },
});

export async function loginUser(
  body: LoginBody,
  deviceName?: string,
  userAgent?: string,
  ipAddress?: string,
) {
  return _defaultService.loginUser(body, deviceName, userAgent, ipAddress);
}

export async function rotateRefreshToken(rawToken: string) {
  return _defaultService.rotateRefreshToken(rawToken);
}

export async function revokeAllRefreshTokens(userId: string) {
  return _defaultService.revokeAllRefreshTokens(userId);
}

export async function registerUser(body: RegisterBody) {
  return _defaultService.registerUser(body);
}

export async function verifyAccount(token: string): Promise<boolean> {
  return _defaultService.verifyAccount(token);
}

export async function resendVerificationEmail(email: string) {
  return _defaultService.resendVerificationEmail(email);
}

export async function requestPasswordReset(email: string) {
  return _defaultService.requestPasswordReset(email);
}

export async function resetPassword(token: string, password: string) {
  return _defaultService.resetPassword(token, password);
}

/**
 * Exchange a refresh token for a new access/refresh token pair.
 * Thin wrapper around rotateRefreshToken used by the auth route.
 */
export async function exchangeRefreshToken(rawToken: string) {
  return _defaultService.exchangeRefreshToken(rawToken);
}

/**
 * Handle an OAuth provider callback: exchange the provider code for a
 * session. Delegates to the session service's OAuth handler.
 */
export async function handleOAuthCallback(
  provider: string,
  code: string,
  deviceName?: string,
  userAgent?: string,
  ipAddress?: string,
) {
  return _defaultService.handleOAuthCallback(provider, code, deviceName, userAgent, ipAddress);
}

/**
 * Complete the account verification flow (route-level alias).
 */
export async function completeVerificationFlow(token: string): Promise<boolean> {
  return _defaultService.completeVerificationFlow(token);
}

/**
 * Complete the password reset flow (route-level alias).
 */
export async function completePasswordResetFlow(token: string, password: string) {
  return _defaultService.completePasswordResetFlow(token, password);
}
