import type { Request, Response } from 'express'
import * as verificationService from '../services/verification.service.js'
import { handleError } from '../utils/handleError.js'

/** POST /api/verifications — submit a verification request */
export async function requestVerification(req: Request, res: Response) {
  try {
    const { workerId, documentUrl, notes } = req.body
    if (!workerId || !documentUrl) {
      return res.status(400).json({ status: 'error', message: 'workerId and documentUrl are required', code: 400 })
    }
    const result = await verificationService.requestVerification(workerId, req.user!.id, documentUrl, notes)
    return res.status(201).json({ data: result, status: 'success', code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/verifications — list all requests (admin) */
export async function listRequests(req: Request, res: Response) {
  try {
    const { status, page = '1', limit = '20' } = req.query
    const result = await verificationService.listRequests(status as string | undefined, Number(page), Number(limit))
    return res.json({ ...result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** PATCH /api/verifications/:id/review — approve or reject (admin) */
export async function reviewRequest(req: Request, res: Response) {
  try {
    const { status, reviewNote } = req.body
    if (!status || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'status must be "approved" or "rejected"', code: 400 })
    }
    const result = await verificationService.reviewRequest(req.params.id, req.user!.id, status, reviewNote)
    return res.json({ data: result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/workers/:id/verifications — get verification history for a worker */
export async function getWorkerVerifications(req: Request, res: Response) {
  try {
    const data = await verificationService.getWorkerVerifications(req.params.id)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
