import type { Request, Response } from 'express'
import * as verificationService from '../services/verification.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { ErrorMessages, HttpStatus } from '../constants/index.js'

/** POST /api/verifications — submit a verification request */
export const requestVerification = catchAsync(async (req: Request, res: Response) => {
  const { workerId, documentUrl, notes } = req.body
  if (!workerId || !documentUrl) {
    throw new AppError(ErrorMessages.VERIFICATION_FIELDS_REQUIRED, HttpStatus.BAD_REQUEST, true, ErrorCode.VALIDATION_ERROR)
  }
  const result = await verificationService.requestVerification(workerId, req.user!.id, documentUrl, notes)
  return res.status(201).json({ data: result, status: 'success', code: 201 })
})

/** GET /api/verifications — list all requests (admin) */
export const listRequests = catchAsync(async (req: Request, res: Response) => {
  const { status, page = '1', limit = '20' } = req.query
  const result = await verificationService.listRequests(status as string | undefined, Number(page), Number(limit))
  return res.json({ ...result, status: 'success', code: 200 })
})

/** PATCH /api/verifications/:id/review — approve or reject (admin) */
export const reviewRequest = catchAsync(async (req: Request, res: Response) => {
  const { status, reviewNote } = req.body
  if (!status || !['approved', 'rejected'].includes(status)) {
    throw new AppError(ErrorMessages.VERIFICATION_STATUS_INVALID, HttpStatus.BAD_REQUEST, true, ErrorCode.VALIDATION_ERROR)
  }
  const result = await verificationService.reviewRequest(req.params.id, req.user!.id, status, reviewNote)
  return res.json({ data: result, status: 'success', code: 200 })
})

/** GET /api/workers/:id/verifications — get verification history for a worker */
export const getWorkerVerifications = catchAsync(async (req: Request, res: Response) => {
  const data = await verificationService.getWorkerVerifications(req.params.id)
  return res.json({ data, status: 'success', code: 200 })
})
