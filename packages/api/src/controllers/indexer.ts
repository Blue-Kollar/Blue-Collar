import { Request, Response } from 'express'
import * as indexerService from '../services/indexer.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

/**
 * GET /api/events?contractId=...&eventName=...&limit=50&offset=0
 * Query indexed contract events
 */
export const queryEvents = catchAsync(async (req: Request, res: Response) => {
  const { contractId, eventName, limit = '50', offset = '0' } = req.query

  if (!contractId) {
    throw new AppError('contractId is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const result = await indexerService.queryEvents(
    contractId as string,
    eventName as string | undefined,
    parseInt(limit as string),
    parseInt(offset as string),
  )

  res.json({
    status: 'success',
    code: 200,
    data: result,
  })
})

/**
 * GET /api/events/worker-registrations/:contractId/:ownerAddress
 * Get worker registration events by owner address
 */
export const getWorkerRegistrations = catchAsync(async (req: Request, res: Response) => {
  const { contractId, ownerAddress } = req.params

  const events = await indexerService.getWorkerRegistrationEvents(contractId, ownerAddress)

  res.json({
    status: 'success',
    code: 200,
    data: events,
  })
})

/**
 * GET /api/events/cursor/:contractId
 * Get current indexer cursor position
 */
export const getCursor = catchAsync(async (req: Request, res: Response) => {
  const { contractId } = req.params

  const cursor = await indexerService.getOrCreateCursor(contractId)

  res.json({
    status: 'success',
    code: 200,
    data: cursor,
  })
})
