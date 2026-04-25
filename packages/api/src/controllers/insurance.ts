import type { Request, Response } from 'express'
import * as insuranceService from '../services/insurance.service.js'
import { handleError } from '../utils/handleError.js'

export async function uploadInsurance(req: Request, res: Response) {
  try {
    const { expiresAt, provider, policyNumber } = req.body
    if (!req.file || !expiresAt) {
      return res.status(400).json({ status: 'error', message: 'document file and expiresAt are required', code: 400 })
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
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getWorkerInsurance(req: Request, res: Response) {
  try {
    const docs = await insuranceService.getWorkerInsurance(req.params.id)
    return res.json({ data: docs, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function updateInsuranceStatus(req: Request, res: Response) {
  try {
    const { status } = req.body
    if (!['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'status must be verified or rejected', code: 400 })
    }
    const doc = await insuranceService.updateInsuranceStatus(req.params.docId, status)
    return res.json({ data: doc, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function triggerRenewalReminders(_req: Request, res: Response) {
  try {
    const count = await insuranceService.sendRenewalReminders()
    return res.json({ data: { remindersSent: count }, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
