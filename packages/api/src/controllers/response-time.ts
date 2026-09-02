import type { Request, Response } from 'express'

import * as responseTimeService from '../services/response-time.service.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'

export const respondToContact = catchAsync(async (req: Request, res: Response) => {
  const { status } = req.body
  if (!['accepted', 'declined'].includes(status)) {
    throw new AppError('status must be accepted or declined', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const request = await responseTimeService.recordResponse(req.params.requestId, status)
  return res.json({ data: request, status: 'success', code: 200 })
})

export const getWorkerResponseStats = catchAsync(async (req: Request, res: Response) => {
  const stats = await responseTimeService.getWorkerResponseStats(req.params.id)
  return res.json({ data: stats, status: 'success', code: 200 })
})

export const getResponseTimeAnalytics = catchAsync(async (_req: Request, res: Response) => {
  const data = await responseTimeService.getResponseTimeAnalytics()
  return res.json({ data, status: 'success', code: 200 })
})
