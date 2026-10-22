import type { NotificationChannel } from './NotificationChannel.js'
import { emailChannel } from './EmailChannel.js'
import { pushChannel } from './PushChannel.js'
import { inAppChannel } from './InAppChannel.js'

/**
 * Channel registry that maintains all available notification channels.
 * Provides methods to retrieve channels by name and get all active channels.
 *
 * Design benefits:
 * - Channels are registered once at startup
 * - New channels can be added without modifying the service
 * - Channels can be enabled/disabled or replaced independently
 * - Testable: can be mocked/stubbed for unit tests
 */
export class ChannelRegistry {
  private channels: Map<string, NotificationChannel>

  constructor(channels: NotificationChannel[] = []) {
    this.channels = new Map()
    // Register default channels
    this.register(inAppChannel)
    this.register(emailChannel)
    this.register(pushChannel)

    // Allow custom channels to be injected (useful for testing)
    for (const channel of channels) {
      this.register(channel)
    }
  }

  /**
   * Register a notification channel.
   * If a channel with the same name already exists, it will be replaced.
   */
  register(channel: NotificationChannel): void {
    this.channels.set(channel.name, channel)
  }

  /**
   * Get a channel by name.
   * @returns The channel or undefined if not found
   */
  getChannel(name: string): NotificationChannel | undefined {
    return this.channels.get(name)
  }

  /**
   * Get all registered channels.
   */
  getAllChannels(): NotificationChannel[] {
    return Array.from(this.channels.values())
  }

  /**
   * Get channels by their names.
   * Silently skips channels that don't exist.
   */
  getChannelsByNames(names: string[]): NotificationChannel[] {
    return names
      .map((name) => this.channels.get(name))
      .filter((ch): ch is NotificationChannel => ch !== undefined)
  }
}

/**
 * Default registry instance with all built-in channels registered.
 */
export const defaultChannelRegistry = new ChannelRegistry()
