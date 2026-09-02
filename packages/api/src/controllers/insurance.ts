import type { Request, Response } from 'express'

import * as insuranceService from '../services/insurance.service.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'

export const uploadInsurance = catchAsync(async (req: Request, res: Response) => {
  const { expiresAt, provider, policyNumber } = req.body
  if (!req.file || !expiresAt) {
    throw new AppError('document file and expiresAt are required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const documentUrl = `/uploads/${req.file.filename}`
  const doc = await insuranceService.uploadInsurance(
    req.params.id,
    documentUrl,
    new Date(expiresAt),
    provider,
    policyNumber,
  )
  return res.status(201).json({ data: doc, status: 'success', code: 201 })
})

export const getWorkerInsurance = catchAsync(async (req: Request, res: Response) => {
  const docs = await insuranceService.getWorkerInsurance(req.params.id)
  return res.json({ data: docs, status: 'success', code: 200 })
})

export const updateInsuranceStatus = catchAsync(async (req: Request, res: Response) => {
  const { status } = req.body
  if (!['verified', 'rejected'].includes(status)) {
    throw new AppError('status must be verified or rejected', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const doc = await insuranceService.updateInsuranceStatus(req.params.docId, status)
  return res.json({ data: doc, status: 'success', code: 200 })
})

export const triggerRenewalReminders = catchAsync(async (_req: Request, res: Response) => {
  const count = await insuranceService.sendRenewalReminders()
  return res.json({ data: { remindersSent: count }, status: 'success', code: 200 })
})
