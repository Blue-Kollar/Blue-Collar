import type { NotificationChannel, NotificationMessage, DeliveryResult } from './NotificationChannel.js'
import { transporter } from '@/mailer/transport.js'
import { notificationRepository } from '@/repositories/notification.repository.js'
import { logger } from '@/config/logger.js'
import { AppError } from '@/utils/app-error.js'
import { nowUtc } from '@/utils/date.js'

/**
 * Email notification channel adapter.
 * Routes email delivery through the mailer service with template rendering.
 */
export class EmailChannel implements NotificationChannel {
  readonly name = 'email'

  /**
   * Determine if email should be sent based on notification type and user preferences.
   * Maps notification types to preference keys for gating logic.
   */
  shouldSend(
    message: NotificationMessage,
    prefs: Record<string, boolean>
  ): boolean {
    const typeMap: Record<string, string> = {
      'review': 'reviewReply',
      'system': 'announcements',
    }

    const prefKey = typeMap[message.type]
    // If no specific mapping, allow by default
    return prefKey ? (prefs[prefKey] ?? true) : true
  }

  /**
   * Send email notification.
   * Fetches user email/name, renders template, and sends via mailer.
   */
  async send(message: NotificationMessage): Promise<DeliveryResult> {
    const result: DeliveryResult = {
      channel: this.name,
      status: 'failed',
      sentAt: nowUtc(),
    }

    try {
      const user = await notificationRepository.findUserEmailAndName(message.userId)
      if (!user) {
        throw new AppError('User not found', 404)
      }

      await transporter.sendMail({
        to: user.email,
        subject: message.title,
        text: message.message,
        html: `<p>${message.message}</p>${
          message.href ? `<a href="${message.href}">View</a>` : ''
        }`,
      })

      result.status = 'sent'
    } catch (error) {
      logger.error(
        { error, userId: message.userId },
        'Email notification failed'
      )
      result.error =
        error instanceof Error ? error.message : 'Unknown error'
    }

    return result
  }
}

export const emailChannel = new EmailChannel()
