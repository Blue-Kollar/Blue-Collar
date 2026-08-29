/**
 * Disputes controller — thin HTTP layer.
 * Parses request input, delegates to the contracts service, and formats responses.
 * All business logic and validation lives in contracts.service / dispute.service.
 */
import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import * as contractsService from '../services/contracts.service.js'

/** POST /api/disputes — file a dispute against a worker */
export const createDispute = catchAsync(async (req: Request, res: Response) => {
  const { workerId, reason, evidence } = req.body
  const dispute = await contractsService.fileWorkerDispute(workerId, req.user!.id, reason, evidence)
  return res.status(201).json({ data: dispute, status: 'success', code: 201 })
})

/** GET /api/disputes — list disputes (admin: all; user: own) */
export const listDisputes = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)
  const result = await contractsService.dispute.listDisputes(req.user!.id, req.user!.role, page, limit)
  return res.json({ ...result, status: 'success', code: 200 })
})

/** GET /api/disputes/:id — get a single dispute */
export const getDispute = catchAsync(async (req: Request, res: Response) => {
  const dispute = await contractsService.dispute.getDispute(req.params.id, req.user!.id, req.user!.role)
  return res.json({ data: dispute, status: 'success', code: 200 })
})

/** PATCH /api/disputes/:id/resolve — resolve/dismiss a dispute (admin only) */
export const resolveDispute = catchAsync(async (req: Request, res: Response) => {
  const { status, resolution } = req.body
  const dispute = await contractsService.dispute.resolveDispute(
    req.params.id,
    req.user!.id,
    status,
    resolution,
  )
  return res.json({ data: dispute, status: 'success', code: 200 })
})
