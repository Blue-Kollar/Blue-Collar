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
    const result = await availabilityService.upsertAvailability(req.params.id, req.body)
    return res.json({ data: result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function addAvailabilitySlot(req: Request, res: Response) {
  try {
    const slot = await availabilityService.addAvailabilitySlot(req.params.id, req.body)
    return res.status(201).json({ data: slot, status: 'success', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function deleteAvailabilitySlot(req: Request, res: Response) {
  try {
    await availabilityService.deleteAvailabilitySlot(req.params.id, req.params.slotId)
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}
