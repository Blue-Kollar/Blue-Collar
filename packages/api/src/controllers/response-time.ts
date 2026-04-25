import type { Request, Response } from 'express'
import * as responseTimeService from '../services/response-time.service.js'
import { handleError } from '../utils/handleError.js'

export async function respondToContact(req: Request, res: Response) {
  try {
    const { status } = req.body
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'status must be accepted or declined', code: 400 })
    }
    const request = await responseTimeService.recordResponse(req.params.requestId, status)
    return res.json({ data: request, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getWorkerResponseStats(req: Request, res: Response) {
  try {
    const stats = await responseTimeService.getWorkerResponseStats(req.params.id)
    return res.json({ data: stats, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getResponseTimeAnalytics(_req: Request, res: Response) {
  try {
    const data = await responseTimeService.getResponseTimeAnalytics()
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
