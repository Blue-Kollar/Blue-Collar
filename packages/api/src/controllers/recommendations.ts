import type { Request, Response } from 'express'
import * as recommendationService from '../services/recommendation.service.js'
import { handleError } from '../utils/handleError.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

export async function getRecommendations(req: Request, res: Response) {
  try {
    const limit = Math.min(Number(req.query.limit ?? 10), 50)
    const result = await recommendationService.getRecommendations(req.user!.id, limit)
    return res.json({ ...result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function trackInteraction(req: Request, res: Response) {
  try {
    const { workerId, type } = req.body
    if (!workerId || !type) {
      throw new AppError('workerId and type are required', 400, true, ErrorCode.VALIDATION_ERROR)
    }
    const validTypes = ['view', 'bookmark', 'tip', 'contact']
    if (!validTypes.includes(type)) {
      throw new AppError(`type must be one of: ${validTypes.join(', ')}`, 400, true, ErrorCode.VALIDATION_ERROR)
    }
    await recommendationService.trackInteraction(req.user!.id, workerId, type)
    return res.status(201).json({ status: 'success', message: 'Interaction tracked', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}
