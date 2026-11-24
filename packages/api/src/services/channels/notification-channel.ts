/**
 * NotificationChannel adapter interface.
 * Each channel implementation (email, push, webhook) conforms to this interface,
 * enabling clean separation of concerns and testability.
 */

export interface NotificationMessage {
  userId: string
  title: string
  message: string
  href?: string
  data?: Record<string, string>
  type: string
}

export interface DeliveryResult {
  channel: string
  status: 'sent' | 'failed'
  error?: string
  sentAt: Date
}

/**
 * Adapter interface that all notification channels must implement.
 * Channels are responsible for:
 * - Checking if they should send based on user preferences
 * - Handling delivery logic specific to their channel
 * - Returning delivery status
 */
export interface NotificationChannel {
  /**
   * Unique identifier for this channel (e.g., 'email', 'push', 'webhook')
   */
  readonly name: string

  /**
   * Determine if this channel should deliver the notification based on user preferences.
   * @param message The notification message
   * @param prefs User's notification preferences
   * @returns true if the channel should attempt delivery
   */
  shouldSend(
    message: NotificationMessage,
    prefs: Record<string, boolean>
  ): boolean | Promise<boolean>

  /**
   * Send the notification through this channel.
   * @param message The notification message
   * @returns Delivery result (sent/failed status and timing)
   * @throws Channel should catch errors internally and return failed status
   */
  send(message: NotificationMessage): Promise<DeliveryResult>
}
