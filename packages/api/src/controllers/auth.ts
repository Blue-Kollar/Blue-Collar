/**
 * Auth controller — thin HTTP layer for authentication endpoints.
 *
 * Error-handling convention: every handler either uses `catchAsync` (so
 * thrown `AppError` instances propagate to the global `errorHandler`
 * middleware) or throws `AppError` directly inside a `catchAsync` wrapper.
 * No handler calls `handleError(res, err)` directly; all errors flow through
 * the central error handler so every error response is guaranteed to include
 * `{ status, message, code, errorCode, traceId }`.
 *
 * Removed (deprecated legacy endpoints — see #1012):
 *   - enrollTwoFactor  (superseded by twoFactor.ts → POST /2fa/setup)
 *   - verifyTwoFactor  (superseded by twoFactor.ts → POST /2fa/verify)
 *   - disableTwoFactor (superseded by twoFactor.ts → DELETE /2fa)
 *   - listDevices      (moved to devices.ts controller)
 *   - revokeDevice     (moved to devices.ts controller)
 *   - revokeAllOtherDevices (moved to devices.ts controller)
 *
 * These functions were never wired into routes/auth.ts; routes/auth.ts
 * imports 2FA handlers from controllers/twoFactor.ts and device handlers
 * from routes/devices.ts.
 */
import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import * as authService from '../services/auth.service.js'
import { db } from '../db.js'
import { sanitizeUser } from '../models/user.model.js'
import { UserResource } from '../resources/index.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'
import { ErrorMessages } from '../constants/errors.js'
import type {
  LoginBody,
  RegisterBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from '../interfaces/index.js'

/**
 * POST /api/auth/login
 * Authenticate a user with email and password.
 *
 * @throws AppError 401 if credentials are invalid.
 * @throws AppError 403 if the account is not yet verified.
 */
export const login = catchAsync(async (req: Request<{}, {}, LoginBody>, res: Response) => {
  const userAgent = req.get('user-agent')
  const ipAddress = (req.get('x-forwarded-for') || req.ip || '').split(',')[0].trim()

  // Parse device name from user agent (basic heuristic)
  let deviceName = 'Unknown Device'
  if (userAgent) {
    if (userAgent.includes('Chrome')) deviceName = 'Chrome'
    else if (userAgent.includes('Firefox')) deviceName = 'Firefox'
    else if (userAgent.includes('Safari')) deviceName = 'Safari'
    else if (userAgent.includes('Mobile')) deviceName = 'Mobile'

    if (userAgent.includes('Windows')) deviceName += ' on Windows'
    else if (userAgent.includes('Macintosh')) deviceName += ' on Mac'
    else if (userAgent.includes('Linux')) deviceName += ' on Linux'
  }

  const { data, token, refreshToken, deviceId } = await authService.loginUser(
    req.body,
    deviceName,
    userAgent,
    ipAddress,
  )
  return res.status(202).json({
    data: UserResource(data as any),
    status: 'success',
    message: 'Login successful',
    code: 202,
    token,
    refreshToken,
    deviceId,
  })
})

/**
 * POST /api/auth/register
 * Create a new user account and send a verification email.
 *
 * @throws AppError 409 if the email is already in use.
 */
export const register = catchAsync(async (req: Request<{}, {}, RegisterBody>, res: Response) => {
  const data = await authService.registerUser(req.body)
  return res.status(201).json({
    data: UserResource(data as any),
    status: 'success',
    message: 'Registration successful. Please check your email to verify your account.',
    code: 201,
  })
})

/**
 * PUT /api/auth/verify-account
 * Verify a user's email address using the token sent in the verification email.
 *
 * @throws AppError 400 if the token is missing, invalid, or expired.
 */
export const verifyAccount = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token ?? req.body.token) as string | undefined
  if (!token) {
    throw new AppError(
      ErrorMessages.VERIFICATION_TOKEN_REQUIRED,
      400,
      true,
      ErrorCode.VALIDATION_ERROR,
    )
  }
  const verified = await authService.verifyAccount(token)
  const message = verified ? 'Email verified successfully' : 'Email already verified'
  return res.status(200).json({ status: 'success', message, code: 200 })
})

/**
 * GET /api/auth/google/callback
 * Handle the Google OAuth callback. Issues a JWT and redirects to the frontend.
 */
export const googleAuthCallback = catchAsync(async (req: Request, res: Response) => {
  const user = req.user as any
  if (!user) return res.redirect(`${env.APP_URL}/login?error=oauth-failed`)
  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: '7d',
  })
  return res.redirect(`${env.APP_URL}/auth-callback?token=${token}`)
})

/**
 * DELETE /api/auth/logout
 * Revokes all refresh tokens for the authenticated user.
 */
export const logout = catchAsync(async (req: Request, res: Response) => {
  if (req.user?.id) {
    await authService.revokeAllRefreshTokens(req.user.id)
  }
  return res.status(200).json({ status: 'success', message: 'Logged out', code: 200 })
})

/**
 * POST /api/auth/refresh
 * Exchange a valid refresh token for a new access token + refresh token pair.
 *
 * Body: { refreshToken: string }
 *
 * @throws AppError 400 if refreshToken is missing.
 * @throws AppError 401 if the refresh token is invalid or expired.
 */
export const refresh = catchAsync(async (req: Request<{}, {}, { refreshToken?: string }>, res: Response) => {
  const { refreshToken } = req.body
  if (!refreshToken) {
    throw new AppError(
      ErrorMessages.REFRESH_TOKEN_REQUIRED,
      400,
      true,
      ErrorCode.VALIDATION_ERROR,
    )
  }
  const tokens = await authService.rotateRefreshToken(refreshToken)
  return res.json({ status: 'success', ...tokens, code: 200 })
})

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 *
 * @throws AppError 404 if the user record no longer exists.
 */
export const me = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.user!
  const user = await db.user.findUnique({ where: { id } })
  if (!user) {
    throw new AppError(ErrorMessages.USER_NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }
  return res.status(200).json({ data: sanitizeUser(user), status: 'success', code: 200 })
})

/**
 * POST /api/auth/forgot-password
 * Send a password reset email. Always returns 200 to prevent email enumeration.
 */
export const forgotPassword = catchAsync(async (req: Request<{}, {}, ForgotPasswordBody>, res: Response) => {
  await authService.requestPasswordReset(req.body.email)
  return res.status(200).json({
    status: 'success',
    message: 'If an account exists with that email, a password reset link has been sent.',
    code: 200,
  })
})

/**
 * PUT /api/auth/reset-password
 * Reset a user's password using the token from the reset email.
 *
 * @throws AppError 400 if `token` or `password` is missing, or if the token is invalid/expired.
 */
export const resetPassword = catchAsync(async (req: Request<{}, {}, ResetPasswordBody>, res: Response) => {
  const { token, password } = req.body
  if (!token || !password) {
    throw new AppError('Token and password are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  await authService.resetPassword(token, password)
  return res.status(200).json({ status: 'success', message: 'Password reset successful', code: 200 })
})

/**
 * POST /api/auth/resend-verification
 * Resend the verification email. Always returns 200 to prevent enumeration.
 */
export const resendVerification = catchAsync(async (req: Request<{}, {}, { email: string }>, res: Response) => {
  await authService.resendVerificationEmail(req.body.email)
  return res.status(200).json({
    status: 'success',
    message: 'If your account exists and is unverified, a new verification email has been sent.',
    code: 200,
  })
})

/**
 * GET /api/auth/unsubscribe-reminders?token=<jwt>
 * Opt a user out of verification reminder emails.
 *
 * @throws AppError 400 if the token is missing, invalid, or expired.
 */
export const unsubscribeReminders = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.query
  if (!token || typeof token !== 'string') {
    throw new AppError(ErrorMessages.TOKEN_REQUIRED, 400, true, ErrorCode.VALIDATION_ERROR)
  }
  let payload: { id?: string; purpose?: string }
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as { id?: string; purpose?: string }
  } catch {
    throw new AppError(ErrorMessages.TOKEN_EXPIRED, 400, true, ErrorCode.TOKEN_INVALID)
  }
  if (payload.purpose !== 'unsubscribe-reminders' || !payload.id) {
    throw new AppError(ErrorMessages.TOKEN_INVALID, 400, true, ErrorCode.TOKEN_INVALID)
  }
  await db.user.update({ where: { id: payload.id }, data: { unsubscribedReminders: true } })
  return res.json({ status: 'success', message: 'You have been unsubscribed from reminder emails', code: 200 })
})
