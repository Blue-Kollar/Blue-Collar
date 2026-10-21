/**
 * Unit tests for the notifications flow (closes #1050).
 *
 * Covers packages/api/src/services/notification.service.ts at the unit level
 * by mocking the Prisma DB client, mailer, push service, and notification channels.
 *
 * Scenarios tested:
 *  - dispatchNotification: in-app notification always created
 *  - dispatchNotification: email sent / skipped based on type preference
 *  - dispatchNotification: push sent / skipped based on type preference
 *  - dispatchNotification: deduplication within the 1-minute window
 *  - dispatchNotification: graceful channel failure (partial delivery)
 *  - dispatchNotification: default preferences when no prefs row exists
 *  - getDeliveryLog: returns stored logs / null for unknown notification
 *  - updateNotificationPreferences: calls upsert with correct payload
 *  - isInQuietHours: returns false when no prefs row, true in quiet window
 *  - Adding a custom channel needs no changes to the core service (adapter isolation)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockNotificationCreate = vi.fn()
const mockNotificationFindMany = vi.fn()
const mockNotificationFindUnique = vi.fn()
const mockNotificationPreferencesFindUnique = vi.fn()
const mockNotificationPreferencesUpsert = vi.fn()
const mockUserFindUnique = vi.fn()

vi.mock('../../db.js', () => ({
  db: {
    notification: {
      create: (...a: unknown[]) => mockNotificationCreate(...a),
      findUnique: (...a: unknown[]) => mockNotificationFindUnique(...a),
      findMany: (...a: unknown[]) => mockNotificationFindMany(...a),
    },
    notificationPreferences: {
      findUnique: (...a: unknown[]) => mockNotificationPreferencesFindUnique(...a),
      upsert: (...a: unknown[]) => mockNotificationPreferencesUpsert(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
  },
}))

// ── Mailer mock ───────────────────────────────────────────────────────────────

const mockMailerSend = vi.fn()

vi.mock('../../mailer/index.js', () => ({
  mailer: { send: (...a: unknown[]) => mockMailerSend(...a) },
}))

// ── Push service mock ─────────────────────────────────────────────────────────

const mockSendPush = vi.fn()

vi.mock('./push.service.js', () => ({
  sendPushNotification: (...a: unknown[]) => mockSendPush(...a),
}))

// ── Logger mock (silence output in tests) ─────────────────────────────────────

vi.mock('../../config/logger.js', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

// ── Helpers ───────────────────────────────────────────────────────────────────

import {
  dispatchNotification,
  getDeliveryLog,
  updateNotificationPreferences,
  isInQuietHours,
  createNotificationService,
} from './notification.service.js'
import type { NotificationChannel } from './channels/NotificationChannel.js'
import { ChannelRegistry } from './channels/ChannelRegistry.js'
import { nowUtc } from '@/utils/date.js'

const USER_ID = 'user-unit-001'
const NOTIF_ID = 'notif-unit-001'

const DEFAULT_PREFS = {
  newWorkerNearby: true,
  statusChange: true,
  reviewReply: true,
  announcements: true,
}

function makeNotification(overrides = {}) {
  return {
    id: NOTIF_ID,
    userId: USER_ID,
    type: 'system',
    title: 'Test',
    message: 'Hello',
    href: null,
    createdAt: new Date(),
    read: false,
    ...overrides,
  }
}

// ── Fake channel implementations for testing ──────────────────────────────────

/**
 * Fake email channel for unit tests.
 * Tracks calls and allows error injection.
 */
class FakeEmailChannel implements NotificationChannel {
  readonly name = 'email'
  public sendCalled = false
  public shouldThrow = false

  shouldSend(message: any, prefs: Record<string, boolean>): boolean {
    const typeMap: Record<string, string> = {
      'review': 'reviewReply',
      'system': 'announcements',
    }
    const prefKey = typeMap[message.type]
    return prefKey ? (prefs[prefKey] ?? true) : true
  }

  async send(message: any) {
    this.sendCalled = true
    if (this.shouldThrow) {
      throw new Error('Fake email channel error')
    }
    return {
      channel: this.name,
      status: 'sent' as const,
      sentAt: nowUtc(),
    }
  }

  reset() {
    this.sendCalled = false
    this.shouldThrow = false
  }
}

/**
 * Fake push channel for unit tests.
 * Tracks calls and allows error injection.
 */
class FakePushChannel implements NotificationChannel {
  readonly name = 'push'
  public sendCalled = false
  public shouldThrow = false

  shouldSend(message: any, prefs: Record<string, boolean>): boolean {
    if (message.type === 'review') {
      return prefs['reviewReply'] ?? true
    }
    return true
  }

  async send(message: any) {
    this.sendCalled = true
    if (this.shouldThrow) {
      throw new Error('Fake push channel error')
    }
    return {
      channel: this.name,
      status: 'sent' as const,
      sentAt: nowUtc(),
    }
  }

  reset() {
    this.sendCalled = false
    this.shouldThrow = false
  }
}

/**
 * Fake in-app channel for unit tests.
 * Always returns success.
 */
class FakeInAppChannel implements NotificationChannel {
  readonly name = 'inapp'
  public sendCalled = false

  shouldSend(): boolean {
    return true
  }

  async send(message: any) {
    this.sendCalled = true
    return {
      channel: this.name,
      status: 'sent' as const,
      sentAt: nowUtc(),
    }
  }

  reset() {
    this.sendCalled = false
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// dispatchNotification
// ═════════════════════════════════════════════════════════════════════════════

describe('dispatchNotification', () => {
  let fakeEmailChannel: FakeEmailChannel
  let fakePushChannel: FakePushChannel
  let fakeInAppChannel: FakeInAppChannel
  let channelRegistry: ChannelRegistry

  beforeEach(() => {
    vi.clearAllMocks()

    // Create fresh fake channels for each test
    fakeEmailChannel = new FakeEmailChannel()
    fakePushChannel = new FakePushChannel()
    fakeInAppChannel = new FakeInAppChannel()

    // Create registry with fake channels
    channelRegistry = new ChannelRegistry([
      fakeInAppChannel,
      fakeEmailChannel,
      fakePushChannel,
    ])

    // Default: prefs row exists with everything enabled
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })
    mockNotificationCreate.mockResolvedValue(makeNotification())
    mockUserFindUnique.mockResolvedValue({
      email: 'user@example.com',
      firstName: 'Test',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ── In-app notification ───────────────────────────────────────────────────

  it('always creates an in-app notification record', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Platform update',
      message: 'New feature launched',
    })

    expect(mockNotificationCreate).toHaveBeenCalledOnce()
    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          type: 'system',
          title: 'Platform update',
          message: 'New feature launched',
        }),
      })
    )
  })

  it('routes through all channels when specified', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Multi-channel',
      message: 'Test message',
      channels: ['inapp', 'email', 'push'],
    })

    // All channels should send
    expect(fakeInAppChannel.sendCalled).toBe(true)
    expect(fakeEmailChannel.sendCalled).toBe(true)
    expect(fakePushChannel.sendCalled).toBe(true)
  })

  // ── Email delivery ────────────────────────────────────────────────────────

  it('sends email when channel is requested and preferences allow it', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Update',
      message: 'Hello',
      channels: ['email'],
    })

    expect(fakeEmailChannel.sendCalled).toBe(true)
  })

  it('skips email for system type when announcements preference is false', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({
      ...DEFAULT_PREFS,
      announcements: false,
    })

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Skipped',
      message: 'Should not send',
      channels: ['email'],
    })

    expect(fakeEmailChannel.sendCalled).toBe(false)
  })

  it('skips email for review type when reviewReply preference is false', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({
      ...DEFAULT_PREFS,
      reviewReply: false,
    })

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'review',
      title: 'Review reply',
      message: 'Someone replied',
      channels: ['email'],
    })

    expect(fakeEmailChannel.sendCalled).toBe(false)
  })

  it('sends email for contact type (default allow)', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'contact',
      title: 'New contact',
      message: 'Someone contacted you',
      channels: ['email'],
    })

    expect(fakeEmailChannel.sendCalled).toBe(true)
  })

  // ── Push delivery ─────────────────────────────────────────────────────────

  it('sends push when channel is requested', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Push me',
      message: 'Go',
      channels: ['push'],
    })

    expect(fakePushChannel.sendCalled).toBe(true)
  })

  it('skips push for review type when reviewReply preference is false', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({
      ...DEFAULT_PREFS,
      reviewReply: false,
    })

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'review',
      title: 'Review',
      message: 'Msg',
      channels: ['push'],
    })

    expect(fakePushChannel.sendCalled).toBe(false)
  })

  // ── Default preferences fallback ──────────────────────────────────────────

  it('uses all-enabled defaults when no preferences row exists for the user', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue(null)

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'No prefs row',
      message: 'Still delivers',
      channels: ['email', 'push'],
    })

    // Both channels should fire even without a prefs row
    expect(fakeEmailChannel.sendCalled).toBe(true)
    expect(fakePushChannel.sendCalled).toBe(true)
  })

  // ── Channel failure resilience ────────────────────────────────────────────

  it('still creates the in-app notification even when email throws', async () => {
    fakeEmailChannel.shouldThrow = true

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Error resilience',
      message: 'Should survive',
      channels: ['inapp', 'email'],
    })

    // in-app record was created despite email failure
    expect(mockNotificationCreate).toHaveBeenCalledOnce()
    expect(fakeInAppChannel.sendCalled).toBe(true)
  })

  it('still creates the in-app notification when push throws', async () => {
    fakePushChannel.shouldThrow = true

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Push failure',
      message: 'Still in-app',
      channels: ['inapp', 'push'],
    })

    expect(mockNotificationCreate).toHaveBeenCalledOnce()
  })

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('deduplicates identical notifications within the 1-minute window', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    const payload = {
      userId: USER_ID,
      type: 'system',
      title: 'Dedup test',
      message: 'Unique message for dedup',
    }

    await service.dispatchNotification(payload)
    await service.dispatchNotification(payload) // duplicate

    // Second call should be deduplicated — notification created only once
    expect(mockNotificationCreate).toHaveBeenCalledOnce()
  })

  it('does NOT deduplicate notifications with different messages', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'T',
      message: 'msg-A',
    })
    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'T',
      message: 'msg-B',
    })

    expect(mockNotificationCreate).toHaveBeenCalledTimes(2)
  })

  // ── href propagation ──────────────────────────────────────────────────────

  it('persists the href field in the notification record', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'tip',
      title: 'New tip',
      message: 'You received a tip',
      href: '/workers/w-001',
    })

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ href: '/workers/w-001' }),
      })
    )
  })

  // ── inapp-only ────────────────────────────────────────────────────────────

  it('does not send email or push when channels is ["inapp"] only', async () => {
    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'In-app only',
      message: 'Silent',
      channels: ['inapp'],
    })

    expect(fakeEmailChannel.sendCalled).toBe(false)
    expect(fakePushChannel.sendCalled).toBe(false)
    expect(fakeInAppChannel.sendCalled).toBe(true)
    expect(mockNotificationCreate).toHaveBeenCalledOnce()
  })

  // ── Adapter isolation: adding a channel needs no change to core service ─────

  it('allows adding a custom channel without modifying the service', async () => {
    class CustomNotificationChannel implements NotificationChannel {
      readonly name = 'custom'
      public sendCalled = false

      shouldSend(): boolean {
        return true
      }

      async send() {
        this.sendCalled = true
        return {
          channel: this.name,
          status: 'sent' as const,
          sentAt: nowUtc(),
        }
      }
    }

    const customChannel = new CustomNotificationChannel()
    const testRegistry = new ChannelRegistry([
      fakeInAppChannel,
      customChannel,
    ])

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry: testRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Custom channel test',
      message: 'Testing new channel',
      channels: ['custom'],
    })

    expect(customChannel.sendCalled).toBe(true)
    // In-app is always included by default, but custom was explicitly requested
    expect(fakeInAppChannel.sendCalled).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// getDeliveryLog
// ═════════════════════════════════════════════════════════════════════════════

// ═════════════════════════════════════════════════════════════════════════════
// getDeliveryLog
// ═════════════════════════════════════════════════════════════════════════════

describe('getDeliveryLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty array when the notification exists but has no cached logs', async () => {
    mockNotificationFindUnique.mockResolvedValue({ id: NOTIF_ID })

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    const logs = await service.getDeliveryLog(NOTIF_ID)
    expect(Array.isArray(logs)).toBe(true)
  })

  it('returns null when the notification does not exist in the DB', async () => {
    mockNotificationFindUnique.mockResolvedValue(null)

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    const logs = await service.getDeliveryLog('non-existent-id')
    expect(logs).toBeNull()
  })

  it('returns delivery logs after a successful dispatch', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })
    mockNotificationCreate.mockResolvedValue(makeNotification({ id: 'log-test-notif' }))
    mockUserFindUnique.mockResolvedValue({ email: 'u@e.com', firstName: 'U' })

    // Create fake channels for this test
    const fakeEmailChannel = new FakeEmailChannel()
    const fakeInAppChannel = new FakeInAppChannel()
    const fakePushChannel = new FakePushChannel()
    const channelRegistry = new ChannelRegistry([
      fakeInAppChannel,
      fakeEmailChannel,
      fakePushChannel,
    ])

    const service = createNotificationService({
      notificationRepository: {} as any,
      channelRegistry,
    })

    await service.dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Log test',
      message: 'Unique log test payload',
      channels: ['email', 'push'],
    })

    mockNotificationFindUnique.mockResolvedValue({ id: 'log-test-notif' })
    const logs = await service.getDeliveryLog('log-test-notif')
    expect(logs).not.toBeNull()
    expect(Array.isArray(logs)).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// updateNotificationPreferences
// ═════════════════════════════════════════════════════════════════════════════

describe('updateNotificationPreferences', () => {
  beforeEach(() => vi.clearAllMocks())

  it('calls upsert with the correct userId and preference data', async () => {
    mockNotificationPreferencesUpsert.mockResolvedValue({})

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    await service.updateNotificationPreferences(USER_ID, {
      announcements: false,
      reviewReply: true,
    })

    expect(mockNotificationPreferencesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        update: expect.objectContaining({
          announcements: false,
          reviewReply: true,
        }),
        create: expect.objectContaining({
          announcements: false,
          reviewReply: true,
        }),
      })
    )
  })

  it('supports partial preference updates', async () => {
    mockNotificationPreferencesUpsert.mockResolvedValue({})

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    await service.updateNotificationPreferences(USER_ID, { newWorkerNearby: false })

    expect(mockNotificationPreferencesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ newWorkerNearby: false }),
      })
    )
  })

  it('supports quiet hours fields', async () => {
    mockNotificationPreferencesUpsert.mockResolvedValue({})

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    await service.updateNotificationPreferences(USER_ID, {
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    })

    expect(mockNotificationPreferencesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        }),
      })
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// isInQuietHours
// ═════════════════════════════════════════════════════════════════════════════

describe('isInQuietHours', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when no preferences row exists', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue(null)

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    const result = await service.isInQuietHours(USER_ID)
    expect(result).toBe(false)
  })

  it('returns true when the current hour is inside the default quiet window (22–8)', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })

    // Fake it being 23:00
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23)

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    const result = await service.isInQuietHours(USER_ID)
    vi.restoreAllMocks()

    expect(result).toBe(true)
  })

  it('returns true at 3 AM (inside quiet window)', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })

    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(3)

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    const result = await service.isInQuietHours(USER_ID)
    vi.restoreAllMocks()

    expect(result).toBe(true)
  })

  it('returns false at 10 AM (outside quiet window)', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })

    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(10)

    const service = createNotificationService({
      notificationRepository: {} as any,
    })

    const result = await service.isInQuietHours(USER_ID)
    vi.restoreAllMocks()

    expect(result).toBe(false)
  })
})
