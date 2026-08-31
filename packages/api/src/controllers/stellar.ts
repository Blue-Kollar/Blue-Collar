import type { Request, Response } from 'express'
import * as stellarService from '../services/stellar.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { WorkerResource } from '../resources/index.js'

export const registerOnChain = catchAsync(async (req: Request, res: Response) => {
  const { contractId } = req.body
  if (!contractId) {
    throw new AppError('contractId is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const worker = await stellarService.registerOnChain(req.params.id, contractId)
  return res.json({
    data: WorkerResource(worker as any),
    status: 'success',
    code: 200
  })
})
