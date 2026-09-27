/**
 * Users controller — thin HTTP layer.
 * Parses request input, delegates to the user service, and formats responses.
 * All error handling flows through the global errorHandler middleware via catchAsync.
 */
import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { db } from '../db.js'
import { sanitizeUser } from '../models/user.model.js'
import * as userService from '../services/user.service.js'
import { ErrorMessages, HttpStatus } from '../constants/index.js'

// ── Profile update ────────────────────────────────────────────────────────────

export const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError(ErrorMessages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, true, ErrorCode.UNAUTHORIZED)

  const { firstName, lastName, phone, bio, onboardingCompleted } = req.body as {
    firstName?: string
    lastName?: string
    phone?: string
    bio?: string
    onboardingCompleted?: boolean
  }

  const user = await db.user.update({
    where: { id: userId },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(phone !== undefined && { phone }),
      ...(bio !== undefined && { bio }),
      ...(onboardingCompleted !== undefined && { onboardingCompleted }),
    },
  })
  return res.json({ data: sanitizeUser(user), status: 'success', code: HttpStatus.OK })
})

export const updateMe = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError(ErrorMessages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, true, ErrorCode.UNAUTHORIZED)

  const user = await userService.updateProfile(userId, req.body)
  return res.json({ data: user, status: 'success', code: HttpStatus.OK })
})

// ── Change password ───────────────────────────────────────────────────────────

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError(ErrorMessages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, true, ErrorCode.UNAUTHORIZED)

  const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string }

  if (!currentPassword || !newPassword) {
    throw new AppError(ErrorMessages.CURRENT_PASSWORD_REQUIRED, HttpStatus.BAD_REQUEST, true, ErrorCode.VALIDATION_ERROR)
  }

  await userService.changePassword(userId, currentPassword, newPassword)
  return res.json({ status: 'success', message: 'Password updated', code: HttpStatus.OK })
})

// ── Delete account ────────────────────────────────────────────────────────────

export const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError(ErrorMessages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, true, ErrorCode.UNAUTHORIZED)

  await userService.deleteAccount(userId)
  return res.json({ status: 'success', message: 'Account deleted', code: HttpStatus.OK })
})

// ── Push subscriptions ────────────────────────────────────────────────────────

export const savePushSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError(ErrorMessages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, true, ErrorCode.UNAUTHORIZED)

  const { endpoint, keys } = req.body
  if (!endpoint || !keys?.auth || !keys?.p256dh) {
    throw new AppError(ErrorMessages.INVALID_PUSH_SUBSCRIPTION, HttpStatus.BAD_REQUEST, true, ErrorCode.VALIDATION_ERROR)
  }

  const subscription = await userService.savePushSubscription(userId, { endpoint, keys })
  return res.json({ data: subscription, status: 'success', code: HttpStatus.CREATED })
})

export const deletePushSubscription = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError(ErrorMessages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, true, ErrorCode.UNAUTHORIZED)

  const { endpoint } = req.body
  if (!endpoint) {
    throw new AppError(ErrorMessages.ENDPOINT_REQUIRED, HttpStatus.BAD_REQUEST, true, ErrorCode.VALIDATION_ERROR)
  }

  await userService.deletePushSubscription(userId, endpoint)
  return res.json({ status: 'success', message: 'Unsubscribed', code: HttpStatus.OK })
})

// ── Onboarding ────────────────────────────────────────────────────────────────

export const completeOnboarding = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) throw new AppError(ErrorMessages.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, true, ErrorCode.UNAUTHORIZED)

  const user = await userService.completeOnboarding(userId)
  return res.json({ data: user, status: 'success', message: 'Onboarding completed', code: HttpStatus.OK })
})
