import type { NotificationChannel, NotificationMessage, DeliveryResult } from './NotificationChannel.js'
import { sendPushNotification } from '../push.service.js'
import { logger } from '@/config/logger.js'
import { nowUtc } from '@/utils/date.js'

/**
 * Push notification channel adapter.
 * Routes push delivery through the web-push service (VAPID-based).
 */
export class PushChannel implements NotificationChannel {
  readonly name = 'push'

  /**
   * Determine if push should be sent based on notification type and user preferences.
   * Review notifications only send if reviewReply is enabled.
   */
  shouldSend(
    message: NotificationMessage,
    prefs: Record<string, boolean>
  ): boolean {
    // Review notifications require explicit preference
    if (message.type === 'review') {
      return prefs['reviewReply'] ?? true
    }
    // All other types are allowed by default
    return true
  }

  /**
   * Send push notification.
   * Delegates to the push service which handles VAPID key setup and subscription management.
   */
  async send(message: NotificationMessage): Promise<DeliveryResult> {
    const result: DeliveryResult = {
      channel: this.name,
      status: 'failed',
      sentAt: nowUtc(),
    }

    try {
      await sendPushNotification(message.userId, {
        title: message.title,
        body: message.message,
        tag: message.type,
      })

      result.status = 'sent'
    } catch (error) {
      logger.error(
        { error, userId: message.userId },
        'Push notification failed'
      )
      result.error =
        error instanceof Error ? error.message : 'Unknown error'
    }

    return result
  }
}

export const pushChannel = new PushChannel()
