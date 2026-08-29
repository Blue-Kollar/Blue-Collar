/**
 * Unit tests for the notifications flow (closes #1050).
 *
 * Covers packages/api/src/services/notification.service.ts at the unit level
 * by mocking the Prisma DB client, the mailer, and the push service.
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
} from './notification.service.js'

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

// ═════════════════════════════════════════════════════════════════════════════
// dispatchNotification
// ═════════════════════════════════════════════════════════════════════════════

describe('dispatchNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: prefs row exists with everything enabled
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })
    mockNotificationCreate.mockResolvedValue(makeNotification())
    mockUserFindUnique.mockResolvedValue({ email: 'user@example.com', firstName: 'Test' })
    mockMailerSend.mockResolvedValue(undefined)
    mockSendPush.mockResolvedValue(undefined)
  })

  afterEach(() => vi.clearAllMocks())

  // ── In-app notification ───────────────────────────────────────────────────

  it('always creates an in-app notification record', async () => {
    await dispatchNotification({
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
      }),
    )
  })

  // ── Email delivery ────────────────────────────────────────────────────────

  it('sends email when channel is requested and preferences allow it', async () => {
    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Update',
      message: 'Hello',
      channels: ['email'],
    })

    expect(mockMailerSend).toHaveBeenCalledOnce()
  })

  it('skips email for system type when announcements preference is false', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({
      ...DEFAULT_PREFS,
      announcements: false,
    })

    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Skipped',
      message: 'Should not send',
      channels: ['email'],
    })

    expect(mockMailerSend).not.toHaveBeenCalled()
  })

  it('skips email for review type when reviewReply preference is false', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({
      ...DEFAULT_PREFS,
      reviewReply: false,
    })

    await dispatchNotification({
      userId: USER_ID,
      type: 'review',
      title: 'Review reply',
      message: 'Someone replied',
      channels: ['email'],
    })

    expect(mockMailerSend).not.toHaveBeenCalled()
  })

  it('sends email for contact type (default allow)', async () => {
    await dispatchNotification({
      userId: USER_ID,
      type: 'contact',
      title: 'New contact',
      message: 'Someone contacted you',
      channels: ['email'],
    })

    expect(mockMailerSend).toHaveBeenCalledOnce()
  })

  // ── Push delivery ─────────────────────────────────────────────────────────

  it('sends push when channel is requested', async () => {
    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Push me',
      message: 'Go',
      channels: ['push'],
    })

    expect(mockSendPush).toHaveBeenCalledOnce()
    expect(mockSendPush).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ title: 'Push me' }),
    )
  })

  it('skips push for review type when reviewReply preference is false', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({
      ...DEFAULT_PREFS,
      reviewReply: false,
    })

    await dispatchNotification({
      userId: USER_ID,
      type: 'review',
      title: 'Review',
      message: 'Msg',
      channels: ['push'],
    })

    expect(mockSendPush).not.toHaveBeenCalled()
  })

  // ── Default preferences fallback ──────────────────────────────────────────

  it('uses all-enabled defaults when no preferences row exists for the user', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue(null)

    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'No prefs row',
      message: 'Still delivers',
      channels: ['email', 'push'],
    })

    // Both channels should fire even without a prefs row
    expect(mockMailerSend).toHaveBeenCalledOnce()
    expect(mockSendPush).toHaveBeenCalledOnce()
  })

  // ── Channel failure resilience ────────────────────────────────────────────

  it('still creates the in-app notification even when email throws', async () => {
    mockMailerSend.mockRejectedValue(new Error('SMTP timeout'))

    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Error resilience',
      message: 'Should survive',
      channels: ['email'],
    })

    // in-app record was created despite email failure
    expect(mockNotificationCreate).toHaveBeenCalledOnce()
  })

  it('still creates the in-app notification when push throws', async () => {
    mockSendPush.mockRejectedValue(new Error('FCM unavailable'))

    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Push failure',
      message: 'Still in-app',
      channels: ['push'],
    })

    expect(mockNotificationCreate).toHaveBeenCalledOnce()
  })

  // ── Deduplication ─────────────────────────────────────────────────────────

  it('deduplicates identical notifications within the 1-minute window', async () => {
    const payload = {
      userId: USER_ID,
      type: 'system',
      title: 'Dedup test',
      message: 'Unique message for dedup',
    }

    await dispatchNotification(payload)
    await dispatchNotification(payload) // duplicate

    // Second call should be deduplicated — notification created only once
    expect(mockNotificationCreate).toHaveBeenCalledOnce()
  })

  it('does NOT deduplicate notifications with different messages', async () => {
    await dispatchNotification({ userId: USER_ID, type: 'system', title: 'T', message: 'msg-A' })
    await dispatchNotification({ userId: USER_ID, type: 'system', title: 'T', message: 'msg-B' })

    expect(mockNotificationCreate).toHaveBeenCalledTimes(2)
  })

  // ── href propagation ──────────────────────────────────────────────────────

  it('persists the href field in the notification record', async () => {
    await dispatchNotification({
      userId: USER_ID,
      type: 'tip',
      title: 'New tip',
      message: 'You received a tip',
      href: '/workers/w-001',
    })

    expect(mockNotificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ href: '/workers/w-001' }),
      }),
    )
  })

  // ── inapp-only ────────────────────────────────────────────────────────────

  it('does not send email or push when channels is ["inapp"] only', async () => {
    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'In-app only',
      message: 'Silent',
      channels: ['inapp'],
    })

    expect(mockMailerSend).not.toHaveBeenCalled()
    expect(mockSendPush).not.toHaveBeenCalled()
    expect(mockNotificationCreate).toHaveBeenCalledOnce()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// getDeliveryLog
// ═════════════════════════════════════════════════════════════════════════════

describe('getDeliveryLog', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns an empty array when the notification exists but has no cached logs', async () => {
    mockNotificationFindUnique.mockResolvedValue({ id: NOTIF_ID })

    const logs = await getDeliveryLog(NOTIF_ID)
    expect(Array.isArray(logs)).toBe(true)
  })

  it('returns null when the notification does not exist in the DB', async () => {
    mockNotificationFindUnique.mockResolvedValue(null)

    const logs = await getDeliveryLog('non-existent-id')
    expect(logs).toBeNull()
  })

  it('returns delivery logs after a successful dispatch', async () => {
    // Reset mocks for an isolated dispatch
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })
    mockNotificationCreate.mockResolvedValue(makeNotification({ id: 'log-test-notif' }))
    mockUserFindUnique.mockResolvedValue({ email: 'u@e.com', firstName: 'U' })
    mockMailerSend.mockResolvedValue(undefined)
    mockSendPush.mockResolvedValue(undefined)

    await dispatchNotification({
      userId: USER_ID,
      type: 'system',
      title: 'Log test',
      message: 'Unique log test payload',
      channels: ['email', 'push'],
    })

    mockNotificationFindUnique.mockResolvedValue({ id: 'log-test-notif' })
    const logs = await getDeliveryLog('log-test-notif')
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

    await updateNotificationPreferences(USER_ID, { announcements: false, reviewReply: true })

    expect(mockNotificationPreferencesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        update: expect.objectContaining({ announcements: false, reviewReply: true }),
        create: expect.objectContaining({ announcements: false, reviewReply: true }),
      }),
    )
  })

  it('supports partial preference updates', async () => {
    mockNotificationPreferencesUpsert.mockResolvedValue({})

    await updateNotificationPreferences(USER_ID, { newWorkerNearby: false })

    expect(mockNotificationPreferencesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ newWorkerNearby: false }),
      }),
    )
  })

  it('supports quiet hours fields', async () => {
    mockNotificationPreferencesUpsert.mockResolvedValue({})

    await updateNotificationPreferences(USER_ID, {
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00',
    })

    expect(mockNotificationPreferencesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00',
        }),
      }),
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

    const result = await isInQuietHours(USER_ID)
    expect(result).toBe(false)
  })

  it('returns true when the current hour is inside the default quiet window (22–8)', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })

    // Fake it being 23:00
    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(23)
    const result = await isInQuietHours(USER_ID)
    vi.restoreAllMocks()

    expect(result).toBe(true)
  })

  it('returns true at 3 AM (inside quiet window)', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })

    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(3)
    const result = await isInQuietHours(USER_ID)
    vi.restoreAllMocks()

    expect(result).toBe(true)
  })

  it('returns false at 10 AM (outside quiet window)', async () => {
    mockNotificationPreferencesFindUnique.mockResolvedValue({ ...DEFAULT_PREFS })

    vi.spyOn(Date.prototype, 'getHours').mockReturnValue(10)
    const result = await isInQuietHours(USER_ID)
    vi.restoreAllMocks()

    expect(result).toBe(false)
  })
})
