import type { Request, Response } from 'express'
import * as disputeService from '../services/dispute.service.js'
import { handleError } from '../utils/handleError.js'

/** POST /api/disputes — file a dispute against a worker */
export async function createDispute(req: Request, res: Response) {
  try {
    const { workerId, reason, evidence } = req.body
    const dispute = await disputeService.fileDispute(workerId, req.user!.id, reason, evidence)
    return res.status(201).json({ data: dispute, status: 'success', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/disputes — list disputes (admin: all; user: own) */
export async function listDisputes(req: Request, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 20)
    const result = await disputeService.listDisputes(req.user!.id, req.user!.role, page, limit)
    return res.json({ ...result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/disputes/:id — get a single dispute */
export async function getDispute(req: Request, res: Response) {
  try {
    const dispute = await disputeService.getDispute(req.params.id, req.user!.id, req.user!.role)
    return res.json({ data: dispute, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** PATCH /api/disputes/:id/resolve — resolve/dismiss a dispute (admin only) */
export async function resolveDispute(req: Request, res: Response) {
  try {
    const { status, resolution } = req.body
    const dispute = await disputeService.resolveDispute(req.params.id, req.user!.id, status, resolution)
    return res.json({ data: dispute, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
