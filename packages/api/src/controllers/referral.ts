import type { Request, Response } from 'express'
import * as referralService from '../services/referral.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

export const getMyReferralCode = catchAsync(async (req: Request, res: Response) => {
  const data = await referralService.getOrCreateReferralCode(req.user!.id)
  return res.json({ data, status: 'success', code: 200 })
})

export const applyReferralCode = catchAsync(async (req: Request, res: Response) => {
  const { code } = req.body
  if (!code) throw new AppError('code is required', 400, true, ErrorCode.VALIDATION_ERROR)
  const referral = await referralService.applyReferralCode(req.user!.id, code)
  return res.status(201).json({ data: referral, status: 'success', code: 201 })
})

export const getMyReferralStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await referralService.getReferralStats(req.user!.id)
  return res.json({ data: stats, status: 'success', code: 200 })
})

export const getLeaderboard = catchAsync(async (_req: Request, res: Response) => {
  const data = await referralService.getReferralLeaderboard()
  return res.json({ data, status: 'success', code: 200 })
})

export const rewardReferral = catchAsync(async (req: Request, res: Response) => {
  const referral = await referralService.rewardReferral(req.params.id)
  return res.json({ data: referral, status: 'success', code: 200 })
})
