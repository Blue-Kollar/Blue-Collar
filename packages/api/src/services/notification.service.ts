import { notificationRepository as defaultNotificationRepository } from '../repositories/notification.repository.js'
import { AppError } from './AppError.js'
import { logger } from '../config/logger.js'
import { mailer } from '../mailer/index.js'
import * as pushService from './push.service.js'
import type { NotificationServiceDeps } from '../container/types.js'

interface NotificationPayload {
  userId: string
  type: string
  title: string
  message: string
  channels?: ('email' | 'push' | 'inapp')[]
  href?: string
  data?: Record<string, string>
}

interface DeliveryLog {
  notificationId: string
  userId: string
  channel: string
  status: 'sent' | 'failed'
  error?: string
  sentAt: Date
}

const deliveryCache = new Map<string, DeliveryLog[]>()
const DEDUP_WINDOW = 60000 // 1 minute

const DEFAULT_PREFERENCES = {
  newWorkerNearby: true,
  statusChange: true,
  reviewReply: true,
  announcements: true,
}

/**
 * Minimal view of a user's notification preferences that the dispatch gates
 * depend on.
 */
interface NotificationPrefsView {
  reviewReply: boolean
  announcements: boolean
}

function shouldSendEmail(prefs: NotificationPrefsView, type: string): boolean {
  const typeMap: Record<string, keyof NotificationPrefsView> = {
    'review': 'reviewReply',
    'system': 'announcements',
  }
  const key = typeMap[type]
  return key ? prefs[key] : true
}

function shouldSendPush(prefs: NotificationPrefsView, type: string): boolean {
  return !['review'].includes(type) || prefs.reviewReply
}

function isDuplicate(dedupKey: string): boolean {
  const cached = deliveryCache.get(dedupKey)
  if (cached && Date.now() - cached[0].sentAt.getTime() < DEDUP_WINDOW) {
    return true
  }
  return false
}

function storeDeliveryLog(notificationId: string, logs: DeliveryLog[]): void {
  deliveryCache.set(notificationId, logs)
  setTimeout(() => {
    deliveryCache.delete(notificationId)
  }, DEDUP_WINDOW)
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createNotificationService(deps: NotificationServiceDeps) {
  const { notificationRepository: repo } = deps

  return {
    async dispatchNotification(payload: NotificationPayload): Promise<void> {
      const prefs = (await repo.findPreferences(payload.userId)) ?? DEFAULT_PREFERENCES

      const channels = payload.channels || ['email', 'push', 'inapp']
      const dedupKey = `${payload.userId}:${payload.type}:${payload.message}`

      if (isDuplicate(dedupKey)) {
        logger.info({ dedupKey }, 'Notification deduplicated')
        return
      }

      const notification = await repo.createNotification({
        userId: payload.userId,
        type: payload.type as any,
        title: payload.title,
        message: payload.message,
        href: payload.href,
      })

      const logs: DeliveryLog[] = []

      if (channels.includes('email') && shouldSendEmail(prefs, payload.type)) {
        try {
          const user = await repo.findUserEmailAndName(payload.userId)
          if (!user) throw new AppError('User not found', 404)

          await mailer.send({
            to: user.email,
            subject: payload.title,
            text: payload.message,
            html: `<p>${payload.message}</p>${payload.href ? `<a href="${payload.href}">View</a>` : ''}`,
          })
          logs.push({ notificationId: notification.id, userId: payload.userId, channel: 'email', status: 'sent', sentAt: new Date() })
        } catch (error) {
          logger.error({ error, userId: payload.userId }, 'Email notification failed')
          logs.push({
            notificationId: notification.id,
            userId: payload.userId,
            channel: 'email',
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            sentAt: new Date(),
          })
        }
      }

      if (channels.includes('push') && shouldSendPush(prefs, payload.type)) {
        try {
          await pushService.sendPushNotification(payload.userId, {
            title: payload.title,
            body: payload.message,
            tag: payload.type,
          })
          logs.push({ notificationId: notification.id, userId: payload.userId, channel: 'push', status: 'sent', sentAt: new Date() })
        } catch (error) {
          logger.error({ error, userId: payload.userId }, 'Push notification failed')
          logs.push({
            notificationId: notification.id,
            userId: payload.userId,
            channel: 'push',
            status: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
            sentAt: new Date(),
          })
        }
      }

      storeDeliveryLog(notification.id, logs)
    },

    async getDeliveryLog(notificationId: string): Promise<DeliveryLog[] | null> {
      const record = await repo.findNotificationById(notificationId)
      if (!record) return null
      return deliveryCache.get(notificationId) || []
    },

    async updateNotificationPreferences(
      userId: string,
      preferences: Partial<{
        newWorkerNearby: boolean
        statusChange: boolean
        reviewReply: boolean
        announcements: boolean
        quietHoursStart?: string
        quietHoursEnd?: string
      }>
    ): Promise<void> {
      await repo.upsertPreferences(userId, preferences)
    },

    async isInQuietHours(userId: string): Promise<boolean> {
      const prefs = await repo.findPreferences(userId)
      if (!prefs) return false

      const hour = new Date().getHours()
      return hour >= 22 || hour < 8
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createNotificationService({
  notificationRepository: defaultNotificationRepository,
})

export async function dispatchNotification(payload: NotificationPayload): Promise<void> {
  return _defaultService.dispatchNotification(payload)
}

export async function getDeliveryLog(notificationId: string): Promise<DeliveryLog[] | null> {
  return _defaultService.getDeliveryLog(notificationId)
}

export async function updateNotificationPreferences(
  userId: string,
  preferences: Partial<{
    newWorkerNearby: boolean
    statusChange: boolean
    reviewReply: boolean
    announcements: boolean
    quietHoursStart?: string
    quietHoursEnd?: string
  }>
): Promise<void> {
  return _defaultService.updateNotificationPreferences(userId, preferences)
}

export async function isInQuietHours(userId: string): Promise<boolean> {
  return _defaultService.isInQuietHours(userId)
}
