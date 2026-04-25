import type { Request, Response } from 'express'
import * as referralService from '../services/referral.service.js'
import { handleError } from '../utils/handleError.js'

export async function getMyReferralCode(req: Request, res: Response) {
  try {
    const data = await referralService.getOrCreateReferralCode(req.user!.id)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function applyReferralCode(req: Request, res: Response) {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ status: 'error', message: 'code is required', code: 400 })
    const referral = await referralService.applyReferralCode(req.user!.id, code)
    return res.status(201).json({ data: referral, status: 'success', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getMyReferralStats(req: Request, res: Response) {
  try {
    const stats = await referralService.getReferralStats(req.user!.id)
    return res.json({ data: stats, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getLeaderboard(_req: Request, res: Response) {
  try {
    const data = await referralService.getReferralLeaderboard()
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function rewardReferral(req: Request, res: Response) {
  try {
    const referral = await referralService.rewardReferral(req.params.id)
    return res.json({ data: referral, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
