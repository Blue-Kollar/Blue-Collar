/**
 * Escrow controller — thin HTTP layer.
 * Parses request input, delegates to the contracts service, and formats responses.
 * All business logic and validation lives in contracts.service / escrow.service.
 */
import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import * as contractsService from '../services/contracts.service.js'

export const listEscrows = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as any
  const result = await contractsService.escrow.listEscrows(
    req.user!.id,
    req.user!.role,
    Number(page ?? 1),
    Number(limit ?? 20),
  )
  return res.json({ ...result, status: 'success', code: 200 })
})

export const getEscrow = catchAsync(async (req: Request, res: Response) => {
  const record = await contractsService.escrow.getEscrow(req.params.id, req.user!.id, req.user!.role)
  return res.json({ data: record, status: 'success', code: 200 })
})

export const createEscrow = catchAsync(async (req: Request, res: Response) => {
  const { jobId, payeeId, amountXlm, expiresAt, txId } = req.body
  const record = await contractsService.createEscrowRecord(req.user!.id, {
    jobId,
    payeeId,
    amountXlm,
    expiresAt,
    txId,
  })
  return res.status(201).json({ data: record, status: 'success', code: 201 })
})

export const activateEscrow = catchAsync(async (req: Request, res: Response) => {
  const { txId } = req.body
  const record = await contractsService.activateEscrowRecord(
    req.params.id,
    txId,
    req.user!.id,
    req.user!.role,
  )
  return res.json({ data: record, status: 'success', code: 200 })
})

export const releaseEscrow = catchAsync(async (req: Request, res: Response) => {
  const record = await contractsService.escrow.releaseEscrow(req.params.id, req.user!.id, req.user!.role)
  return res.json({ data: record, status: 'success', code: 200 })
})

export const cancelEscrow = catchAsync(async (req: Request, res: Response) => {
  const record = await contractsService.escrow.cancelEscrow(req.params.id, req.user!.id, req.user!.role)
  return res.json({ data: record, status: 'success', code: 200 })
})

export const fileDispute = catchAsync(async (req: Request, res: Response) => {
  const { reason, evidence } = req.body
  const dispute = await contractsService.fileEscrowDispute(req.params.id, req.user!.id, { reason, evidence })
  return res.status(201).json({ data: dispute, status: 'success', code: 201 })
})

export const resolveDispute = catchAsync(async (req: Request, res: Response) => {
  const { status, resolution } = req.body
  const dispute = await contractsService.resolveEscrowDispute(
    req.params.disputeId,
    req.user!.id,
    status,
    resolution,
  )
  return res.json({ data: dispute, status: 'success', code: 200 })
})
