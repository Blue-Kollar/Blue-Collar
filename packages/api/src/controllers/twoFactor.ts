import type { Request, Response } from 'express'
import * as twoFactorService from '../services/twoFactor.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

/** POST /api/auth/2fa/setup — generate secret + QR code */
export const setup2FA = catchAsync(async (req: Request, res: Response) => {
  const result = await twoFactorService.setupTwoFactor(req.user!.id)
  return res.status(200).json({ data: result, status: 'success', code: 200 })
})

/** POST /api/auth/2fa/enable — verify token and activate 2FA */
export const enable2FA = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) throw new AppError('token is required', 400, true, ErrorCode.VALIDATION_ERROR)
  const result = await twoFactorService.enableTwoFactor(req.user!.id, String(token))
  return res.status(200).json({ data: result, status: 'success', code: 200 })
})

/** POST /api/auth/2fa/verify — verify TOTP during login */
export const verify2FA = catchAsync(async (req: Request, res: Response) => {
  const { userId, token } = req.body
  if (!userId || !token) {
    throw new AppError('userId and token are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const valid = await twoFactorService.verifyTwoFactor(String(userId), String(token))
  if (!valid) throw new AppError('Invalid TOTP token', 401, true, ErrorCode.UNAUTHORIZED)
  return res.status(200).json({ status: 'success', message: '2FA verified', code: 200 })
})

/** POST /api/auth/2fa/verify-backup — verify a backup code */
export const verifyBackupCode = catchAsync(async (req: Request, res: Response) => {
  const { userId, code } = req.body
  if (!userId || !code) {
    throw new AppError('userId and code are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const valid = await twoFactorService.verifyBackupCode(String(userId), String(code))
  if (!valid) throw new AppError('Invalid backup code', 401, true, ErrorCode.UNAUTHORIZED)
  return res.status(200).json({ status: 'success', message: 'Backup code accepted', code: 200 })
})

/** DELETE /api/auth/2fa — disable 2FA */
export const disable2FA = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) throw new AppError('token is required', 400, true, ErrorCode.VALIDATION_ERROR)
  await twoFactorService.disableTwoFactor(req.user!.id, String(token))
  return res.status(200).json({ status: 'success', message: '2FA disabled', code: 200 })
})

/** POST /api/auth/2fa/backup-codes/regenerate — regenerate backup codes */
export const regenerateBackupCodes = catchAsync(async (req: Request, res: Response) => {
  const { token } = req.body
  if (!token) throw new AppError('token is required', 400, true, ErrorCode.VALIDATION_ERROR)
  const result = await twoFactorService.regenerateBackupCodes(req.user!.id, String(token))
  return res.status(200).json({ data: result, status: 'success', code: 200 })
})
