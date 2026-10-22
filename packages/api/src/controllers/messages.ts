import { Request, Response } from 'express'
import * as messagingService from '@/services/messaging.service.js'
import { catchAsync } from '@/utils/catchAsync.js'
import { sanitizeString } from '@/utils/sanitize.js'

interface AuthRequest extends Request {
  user?: { id: string }
}

export const getConversations = catchAsync(async (req: AuthRequest, res: Response) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const result = await messagingService.getUserConversations(req.user!.id, page, limit)
  res.json({ status: 'success', data: result.data, meta: result.meta })
})

export const getConversation = catchAsync(async (req: AuthRequest, res: Response) => {
  const conversation = await messagingService.getConversation(
    req.params.conversationId!,
    req.user!.id
  )
  res.json({ status: 'success', data: conversation })
})

export const createConversation = catchAsync(async (req: AuthRequest, res: Response) => {
  const { participantIds, subject } = req.body

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    res.status(400).json({ status: 'error', message: 'participantIds must be a non-empty array' })
    return
  }
  if (!participantIds.every((id: unknown) => typeof id === 'string' && id.length > 0)) {
    res.status(400).json({ status: 'error', message: 'participantIds must contain valid ids' })
    return
  }

  const sanitizedSubject = sanitizeString(subject)
  if (sanitizedSubject.length > 200) {
    res.status(400).json({ status: 'error', message: 'subject must be 200 characters or fewer' })
    return
  }

  const conversation = await messagingService.createConversation(
    [req.user!.id, ...participantIds],
    sanitizedSubject
  )
  res.status(201).json({ status: 'success', data: conversation })
})

export const searchMessages = catchAsync(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params
  const { q } = req.query
  const sanitizedQuery = sanitizeString(q as string)
  const messages = await messagingService.searchMessages(
    conversationId!,
    sanitizedQuery,
    req.user!.id
  )
  res.json({ status: 'success', data: messages })
})

export const deleteMessage = catchAsync(async (req: AuthRequest, res: Response) => {
  await messagingService.deleteMessage(req.params.messageId!, req.user!.id)
  res.json({ status: 'success', message: 'Message deleted' })
})

export const markAsRead = catchAsync(async (req: AuthRequest, res: Response) => {
  await messagingService.markConversationAsRead(req.params.conversationId!, req.user!.id)
  res.json({ status: 'success', message: 'Marked as read' })
})

export const getUnreadCount = catchAsync(async (req: AuthRequest, res: Response) => {
  const count = await messagingService.getUnreadCount(req.user!.id)
  res.json({ status: 'success', data: { unreadCount: count } })
})
