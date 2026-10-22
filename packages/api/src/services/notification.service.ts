import type { NotificationType } from '@prisma/client'
import { notificationRepository as defaultNotificationRepository } from '@/repositories/notification.repository.js'
import { AppError } from '@/utils/app-error.js'
import { logger } from '@/config/logger.js'
import { nowUtc } from '@/utils/date.js'
import {
  type ChannelRegistry,
  type NotificationMessage,
  type DeliveryResult,
  defaultChannelRegistry,
} from './channels/index.js'
import type { NotificationServiceDeps } from '@/container/types.js'

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

function isDuplicate(dedupKey: string): boolean {
  const cached = deliveryCache.get(dedupKey)
  if (cached?.[0] && nowUtc().getTime() - cached[0].sentAt.getTime() < DEDUP_WINDOW) {
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

interface NotificationServiceDepsWithChannels extends NotificationServiceDeps {
  channelRegistry?: ChannelRegistry
}

export function createNotificationService(deps: NotificationServiceDepsWithChannels) {
  const { notificationRepository: repo } = deps
  const channelRegistry = deps.channelRegistry ?? defaultChannelRegistry

  return {
    async dispatchNotification(payload: NotificationPayload): Promise<void> {
      const prefs = (await repo.findPreferences(payload.userId)) ?? DEFAULT_PREFERENCES
      const requestedChannelNames = payload.channels || ['inapp', 'email', 'push']
      const dedupKey = `${payload.userId}:${payload.type}:${payload.message}`

      if (isDuplicate(dedupKey)) {
        logger.info({ dedupKey }, 'Notification deduplicated')
        return
      }

      // NOTE: payload.type is used across the codebase with many values that are not in
      // the NotificationType enum (tip/review/contact/system/message) — e.g. 'booking_request',
      // 'booking_confirmed'. Those calls will fail Prisma's enum validation at runtime, but every
      // dispatchNotification() call site swallows the error via .catch(() => {}), so it fails
      // silently. This any-cleanup surfaced the mismatch but does not fix it (out of scope).
      const notification = await repo.createNotification({
        userId: payload.userId,
        type: payload.type as unknown as NotificationType,
        title: payload.title,
        message: payload.message,
        href: payload.href,
      })

      // Build the message for channel adapters
      const message: NotificationMessage = {
        userId: payload.userId,
        type: payload.type,
        title: payload.title,
        message: payload.message,
        href: payload.href,
        data: payload.data,
      }

      // Get requested channels (at least inapp is always included)
      const channels = channelRegistry.getChannelsByNames(requestedChannelNames)

      // Route through each channel, filtering by shouldSend and collecting results
      const logs: DeliveryLog[] = []
      for (const channel of channels) {
        try {
          // Check if channel should send based on preferences
          const should = await channel.shouldSend(message, prefs)
          if (!should) {
            continue
          }

          // Deliver through the channel
          const result = await channel.send(message)

          logs.push({
            notificationId: notification.id,
            userId: payload.userId,
            channel: result.channel,
            status: result.status,
            error: result.error,
            sentAt: result.sentAt,
          })
        } catch (error) {
          logger.error(
            { error, userId: payload.userId, channel: channel.name },
            'Channel dispatch error'
          )
          logs.push({
            notificationId: notification.id,
            userId: payload.userId,
            channel: channel.name,
            status: 'failed',
            error:
              error instanceof Error ? error.message : 'Unknown error',
            sentAt: nowUtc(),
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

      const hour = nowUtc().getUTCHours()
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