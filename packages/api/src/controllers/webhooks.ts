import type { Request, Response } from 'express'
import * as webhookService from '../services/webhook.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

const VALID_EVENTS = [
  'worker.created', 'worker.updated', 'worker.deleted',
  'review.created', 'user.registered', 'dispute.created',
]

export const createSubscription = catchAsync(async (req: Request, res: Response) => {
  const { url, events } = req.body
  if (!url || !Array.isArray(events) || events.length === 0) {
    throw new AppError('url and events[] are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const invalid = events.filter((e: string) => !VALID_EVENTS.includes(e))
  if (invalid.length > 0) {
    throw new AppError(`Invalid events: ${invalid.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`, 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const sub = await webhookService.createSubscription(req.user!.id, url, events)
  return res.status(201).json({ data: sub, status: 'success', code: 201 })
})

export const listSubscriptions = catchAsync(async (req: Request, res: Response) => {
  const subs = await webhookService.listSubscriptions(req.user!.id)
  return res.json({ data: subs, status: 'success', code: 200 })
})

export const deleteSubscription = catchAsync(async (req: Request, res: Response) => {
  const result = await webhookService.deleteSubscription(req.params.id, req.user!.id)
  if (!result) throw new AppError('Subscription not found', 404, true, ErrorCode.NOT_FOUND)
  return res.status(204).send()
})

export const getLogs = catchAsync(async (req: Request, res: Response) => {
  const { page = '1', limit = '20' } = req.query
  const result = await webhookService.getLogs(req.params.id, req.user!.id, Number(page), Number(limit))
  if (!result) throw new AppError('Subscription not found', 404, true, ErrorCode.NOT_FOUND)
  return res.json({ ...result, status: 'success', code: 200 })
})
