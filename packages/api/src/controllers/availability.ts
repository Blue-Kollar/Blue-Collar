import type { Request, Response } from 'express'
import * as availabilityService from '../services/availability.service.js'
import { catchAsync } from '../utils/catchAsync.js'

export const getAvailability = catchAsync(async (req: Request, res: Response) => {
  const availability = await availabilityService.getAvailability(req.params.id)
  return res.json({ data: availability, status: 'success', code: 200 })
})

export const upsertAvailability = catchAsync(async (req: Request, res: Response) => {
  const result = await availabilityService.upsertAvailability(req.params.id, req.body)
  return res.json({ data: result, status: 'success', code: 200 })
})

export const addAvailabilitySlot = catchAsync(async (req: Request, res: Response) => {
  const slot = await availabilityService.addAvailabilitySlot(req.params.id, req.body)
  return res.status(201).json({ data: slot, status: 'success', code: 201 })
})

export const deleteAvailabilitySlot = catchAsync(async (req: Request, res: Response) => {
  await availabilityService.deleteAvailabilitySlot(req.params.id, req.params.slotId)
  return res.status(204).send()
})
