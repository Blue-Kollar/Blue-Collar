import type { NotificationChannel, NotificationMessage, DeliveryResult } from './NotificationChannel.js'
import { notificationRepository } from '@/repositories/notification.repository.js'
import { logger } from '@/config/logger.js'
import { nowUtc } from '@/utils/date.js'
import type { NotificationType } from '@prisma/client'

/**
 * In-app notification channel adapter.
 * Creates notification records in the database for the user's notification center.
 * Always sends (no preference gating) as in-app is the core delivery mechanism.
 */
export class InAppChannel implements NotificationChannel {
  readonly name = 'inapp'

  /**
   * In-app notifications always send regardless of preferences.
   * This ensures users have a record of all notifications in their center.
   */
  shouldSend(): boolean {
    return true
  }

  /**
   * Create an in-app notification record.
   * This is the core delivery mechanism and never fails (errors are logged but don't block).
   */
  async send(message: NotificationMessage): Promise<DeliveryResult> {
    const result: DeliveryResult = {
      channel: this.name,
      status: 'failed',
      sentAt: nowUtc(),
    }

    try {
      await notificationRepository.createNotification({
        userId: message.userId,
        type: message.type as unknown as NotificationType,
        title: message.title,
        message: message.message,
        href: message.href,
      })

      result.status = 'sent'
    } catch (error) {
      logger.error(
        { error, userId: message.userId },
        'In-app notification creation failed'
      )
      result.error =
        error instanceof Error ? error.message : 'Unknown error'
    }

    return result
  }
}

export const inAppChannel = new InAppChannel()
