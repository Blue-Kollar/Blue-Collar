import type { Request, Response } from 'express'
import * as contactRequestService from '../services/contact-request.service.js'
import { handleError } from '../utils/handleError.js'

export async function createContactRequest(req: Request, res: Response) {
  try {
    const { message } = req.body
    if (!message) {
      return res.status(400).json({ status: 'error', message: 'message is required', code: 400 })
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
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getContactRequests(req: Request, res: Response) {
  try {
    const requests = await contactRequestService.getContactRequests(req.params.id)
    return res.json({ data: requests, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function updateContactRequestStatus(req: Request, res: Response) {
  try {
    const { status } = req.body
    if (!['accepted', 'declined'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status', code: 400 })
    }
    const request = await contactRequestService.updateContactRequestStatus(req.params.requestId, status)
    return res.json({ data: request, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
