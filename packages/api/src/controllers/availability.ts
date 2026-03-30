import type { Request, Response } from 'express'
import * as availabilityService from '../services/availability.service.js'
import { handleError } from '../utils/handleError.js'

export async function getAvailability(req: Request, res: Response) {
  try {
    const availability = await availabilityService.getAvailability(req.params.id)
    return res.json({ data: availability, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function upsertAvailability(req: Request, res: Response) {
  try {
    const availability = await availabilityService.upsertAvailability(req.params.id, req.body)
    return res.json({ data: availability, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
