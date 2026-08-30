import type { Request, Response } from 'express'
import * as notificationService from '../services/notification.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { db } from '../db.js'

interface AuthRequest extends Request {
  user?: { id: string }
}

export const listNotifications = catchAsync(async (req: AuthRequest, res: Response) => {
  const page = Number(req.query.page ?? 1)
  const limit = Math.min(Number(req.query.limit ?? 20), 50)
  const userId = req.user!.id
  // Issue #1217: single Promise.all to avoid sequential count + findMany queries
  const [result, total] = await Promise.all([
    db.notification.findMany({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.notification.count({ where: { userId } }),
  ])
  return res.json({
    data: result,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
    status: 'success',
    code: 200,
  })
})

export const getUnreadCount = catchAsync(async (req: AuthRequest, res: Response) => {
  const count = await db.notification.count({
    where: { userId: req.user!.id, read: false },
  })
  return res.json({ data: { count }, status: 'success', code: 200 })
})

export const markRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const notification = await db.notification.findUnique({ where: { id: req.params.id } })
  if (!notification || notification.userId !== req.user!.id) {
    throw new AppError('Not found', 404, true, ErrorCode.NOT_FOUND)
  }
  const updated = await db.notification.update({
    where: { id: req.params.id },
    data: { read: true },
  })
  return res.json({ data: updated, status: 'success', code: 200 })
})

export const markAllRead = catchAsync(async (req: AuthRequest, res: Response) => {
  const result = await db.notification.updateMany({
    where: { userId: req.user!.id, read: false },
    data: { read: true },
  })
  return res.json({ data: { count: result.count }, status: 'success', code: 200 })
})

export const deleteNotification = catchAsync(async (req: AuthRequest, res: Response) => {
  const notification = await db.notification.findUnique({ where: { id: req.params.id } })
  if (!notification || notification.userId !== req.user!.id) {
    throw new AppError('Not found', 404, true, ErrorCode.NOT_FOUND)
  }
  await db.notification.delete({ where: { id: req.params.id } })
  return res.status(204).send()
})

export const getPreferences = catchAsync(async (req: AuthRequest, res: Response) => {
  const prefs = await db.notificationPreferences.findUnique({
    where: { userId: req.user!.id },
  })
  res.json({
    data: prefs || {
      newWorkerNearby: true,
      statusChange: true,
      reviewReply: true,
      announcements: true,
    },
    status: 'success',
  })
})

export const updatePreferences = catchAsync(async (req: AuthRequest, res: Response) => {
  const { newWorkerNearby, statusChange, reviewReply, announcements } = req.body
  await notificationService.updateNotificationPreferences(req.user!.id, {
    newWorkerNearby,
    statusChange,
    reviewReply,
    announcements,
  })
  res.json({ status: 'success', message: 'Preferences updated' })
})

export const dispatchMultiChannel = catchAsync(async (req: AuthRequest, res: Response) => {
  const { type, title, message, channels, href } = req.body
  await notificationService.dispatchNotification({
    userId: req.user!.id,
    type,
    title,
    message,
    channels,
    href,
  })
  res.status(201).json({ status: 'success', message: 'Notification dispatched' })
})

export const getDeliveryLog = catchAsync(async (req: AuthRequest, res: Response) => {
  const log = await notificationService.getDeliveryLog(req.params.notificationId)
  if (!log) {
    throw new AppError('Not found', 404, true, ErrorCode.NOT_FOUND)
  }
  res.json({ data: log, status: 'success' })
})
