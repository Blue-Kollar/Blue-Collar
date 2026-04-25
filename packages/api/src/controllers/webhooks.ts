import type { Request, Response } from 'express'
import * as webhookService from '../services/webhook.service.js'
import { handleError } from '../utils/handleError.js'

const VALID_EVENTS = [
  'worker.created', 'worker.updated', 'worker.deleted',
  'review.created', 'user.registered', 'dispute.created',
]

export async function createSubscription(req: Request, res: Response) {
  try {
    const { url, events } = req.body
    if (!url || !Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ status: 'error', message: 'url and events[] are required', code: 400 })
    }
    const invalid = events.filter((e: string) => !VALID_EVENTS.includes(e))
    if (invalid.length > 0) {
      return res.status(400).json({ status: 'error', message: `Invalid events: ${invalid.join(', ')}. Valid: ${VALID_EVENTS.join(', ')}`, code: 400 })
    }
    const sub = await webhookService.createSubscription(req.user!.id, url, events)
    return res.status(201).json({ data: sub, status: 'success', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function listSubscriptions(req: Request, res: Response) {
  try {
    const subs = await webhookService.listSubscriptions(req.user!.id)
    return res.json({ data: subs, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function deleteSubscription(req: Request, res: Response) {
  try {
    const result = await webhookService.deleteSubscription(req.params.id, req.user!.id)
    if (!result) return res.status(404).json({ status: 'error', message: 'Subscription not found', code: 404 })
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getLogs(req: Request, res: Response) {
  try {
    const { page = '1', limit = '20' } = req.query
    const result = await webhookService.getLogs(req.params.id, req.user!.id, Number(page), Number(limit))
    if (!result) return res.status(404).json({ status: 'error', message: 'Subscription not found', code: 404 })
    return res.json({ ...result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
