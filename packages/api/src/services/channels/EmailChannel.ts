import type { NotificationChannel, NotificationMessage, DeliveryResult } from './NotificationChannel.js'
import { transporter } from '@/mailer/transport.js'
import { notificationRepository } from '@/repositories/notification.repository.js'
import { logger } from '@/config/logger.js'
import { AppError } from '@/utils/app-error.js'
import { nowUtc } from '@/utils/date.js'
import { escapeHtml } from '@/utils/sanitize.js'

/** Only http(s) links and same-origin relative paths are safe in an email anchor. */
function safeHref(href?: string): string | undefined {
  if (!href) return undefined
  const trimmed = href.trim()
  return /^(https?:\/\/|\/)/i.test(trimmed) ? trimmed : undefined
}

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

      const href = safeHref(message.href)
      await transporter.sendMail({
        to: user.email,
        subject: message.title,
        text: message.message,
        html: `<p>${escapeHtml(message.message)}</p>${
          href ? `<a href="${escapeHtml(href)}">View</a>` : ''
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
