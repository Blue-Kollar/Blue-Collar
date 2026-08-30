import type { Request, Response } from 'express'
import * as contactRequestService from '../services/contact-request.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

export const createContactRequest = catchAsync(async (req: Request, res: Response) => {
  const { message } = req.body
  if (!message) {
    throw new AppError('message is required', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const contactRequest = await contactRequestService.createContactRequest(
    req.params.id,
    req.user!.id,
    message
  )
  return res.status(201).json({
    data: contactRequest,
    status: 'success',
    code: 201
  })
})

export const getContactRequests = catchAsync(async (req: Request, res: Response) => {
  const requests = await contactRequestService.getContactRequests(req.params.id)
  return res.json({ data: requests, status: 'success', code: 200 })
})

export const updateContactRequestStatus = catchAsync(async (req: Request, res: Response) => {
  const { status } = req.body
  if (!['accepted', 'declined'].includes(status)) {
    throw new AppError('Invalid status', 400, true, ErrorCode.VALIDATION_ERROR)
  }
  const request = await contactRequestService.updateContactRequestStatus(req.params.requestId, status)
  return res.json({ data: request, status: 'success', code: 200 })
})
