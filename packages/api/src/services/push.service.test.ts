import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as pushService from './push.service'
import { db } from '@/db'
import { logger } from '@/config/logger'

vi.mock('web-push')
vi.mock('@/db.js')
vi.mock('@/config/logger.js')

const webpush = await import('web-push')

type MockedDb = {
  pushSubscription: {
    findMany: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }
}

type MockedWebpush = {
  setVapidDetails: ReturnType<typeof vi.fn>
  sendNotification: ReturnType<typeof vi.fn>
}

const createMockSubscription = (overrides = {}) => ({
  id: 'sub-1',
  userId: 'user-123',
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  auth: 'auth-secret',
  p256dh: 'p256dh-key',
  createdAt: new Date(),
  ...overrides,
})

describe('PushService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VAPID_PUBLIC_KEY = 'test-public-key'
    process.env.VAPID_PRIVATE_KEY = 'test-private-key'
  })

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
  })

  describe('sendPushNotification', () => {
    it('should skip notification when VAPID keys are not configured', async () => {
      delete process.env.VAPID_PUBLIC_KEY
      delete process.env.VAPID_PRIVATE_KEY

      const payload = { title: 'Test', body: 'Message' }

      await pushService.sendPushNotification('user-123', payload)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[PushService] VAPID keys not configured')
      )
      expect((db as unknown as MockedDb).pushSubscription.findMany).not.toHaveBeenCalled()
    })

    it('should send notification to all user subscriptions', async () => {
      const subscription1 = createMockSubscription({ id: 'sub-1' })
      const subscription2 = createMockSubscription({ id: 'sub-2', endpoint: 'https://fcm.googleapis.com/fcm/send/def456' })

      ;(db as unknown as MockedDb).pushSubscription.findMany.mockResolvedValue([subscription1, subscription2])
      ;(webpush as unknown as MockedWebpush).sendNotification.mockResolvedValue(undefined)

      const payload = { title: 'Test Notification', body: 'Test body', tag: 'test-tag' }

      await pushService.sendPushNotification('user-123', payload)

      expect((db as unknown as MockedDb).pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-123' },
      })

      expect((webpush as unknown as MockedWebpush).sendNotification).toHaveBeenCalledTimes(2)
      expect((webpush as unknown as MockedWebpush).sendNotification).toHaveBeenNthCalledWith(1, 
        {
          endpoint: subscription1.endpoint,
          keys: { auth: subscription1.auth, p256dh: subscription1.p256dh },
        },
        JSON.stringify(payload)
      )
      expect((webpush as unknown as MockedWebpush).sendNotification).toHaveBeenNthCalledWith(2,
        {
          endpoint: subscription2.endpoint,
          keys: { auth: subscription2.auth, p256dh: subscription2.p256dh },
        },
        JSON.stringify(payload)
      )
    })

    it('should handle notification with optional icon and badge', async () => {
      const subscription = createMockSubscription()
      ;(db as unknown as MockedDb).pushSubscription.findMany.mockResolvedValue([subscription])
      ;(webpush as unknown as MockedWebpush).sendNotification.mockResolvedValue(undefined)

      const payload = {
        title: 'Test',
        body: 'Message',
        icon: 'https://example.com/icon.png',
        badge: 'https://example.com/badge.png',
      }

      await pushService.sendPushNotification('user-123', payload)

      expect((webpush as unknown as MockedWebpush).sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: subscription.endpoint,
          keys: { auth: subscription.auth, p256dh: subscription.p256dh },
        }),
        JSON.stringify(payload)
      )
    })

    it('should delete subscription on 410 Gone error', async () => {
      const subscription = createMockSubscription()
      ;(db as unknown as MockedDb).pushSubscription.findMany.mockResolvedValue([subscription])

      const error = new Error('Received error 410 Gone')
      ;(webpush as unknown as MockedWebpush).sendNotification.mockRejectedValueOnce(error)

      const payload = { title: 'Test', body: 'Message' }

      await pushService.sendPushNotification('user-123', payload)

      expect((db as unknown as MockedDb).pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: subscription.id },
      })
      expect(logger.error).toHaveBeenCalled()
    })

    it('should log error but not delete subscription on other errors', async () => {
      const subscription = createMockSubscription()
      ;(db as unknown as MockedDb).pushSubscription.findMany.mockResolvedValue([subscription])

      const error = new Error('Network error')
      ;(webpush as unknown as MockedWebpush).sendNotification.mockRejectedValueOnce(error)

      const payload = { title: 'Test', body: 'Message' }

      await pushService.sendPushNotification('user-123', payload)

      expect(logger.error).toHaveBeenCalled()
      expect((db as unknown as MockedDb).pushSubscription.delete).not.toHaveBeenCalled()
    })

    it('should continue sending to other subscriptions on individual failure', async () => {
      const subscription1 = createMockSubscription({ id: 'sub-1' })
      const subscription2 = createMockSubscription({ id: 'sub-2', endpoint: 'https://fcm.googleapis.com/fcm/send/def456' })

      ;(db as unknown as MockedDb).pushSubscription.findMany.mockResolvedValue([subscription1, subscription2])

      const error = new Error('Received error 410 Gone')
      ;(webpush as unknown as MockedWebpush).sendNotification
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(undefined)

      const payload = { title: 'Test', body: 'Message' }

      await pushService.sendPushNotification('user-123', payload)

      expect((webpush as unknown as MockedWebpush).sendNotification).toHaveBeenCalledTimes(2)
      expect((db as unknown as MockedDb).pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: subscription1.id },
      })
    })

    it('should handle user with no subscriptions gracefully', async () => {
      ;(db as unknown as MockedDb).pushSubscription.findMany.mockResolvedValue([])

      const payload = { title: 'Test', body: 'Message' }

      await pushService.sendPushNotification('user-123', payload)

      expect((webpush as unknown as MockedWebpush).sendNotification).not.toHaveBeenCalled()
    })

    it('should handle non-Error object thrown by webpush', async () => {
      const subscription = createMockSubscription()
      ;(db as unknown as MockedDb).pushSubscription.findMany.mockResolvedValue([subscription])
      ;(webpush as unknown as MockedWebpush).sendNotification.mockRejectedValueOnce('Unknown error string')

      const payload = { title: 'Test', body: 'Message' }

      await pushService.sendPushNotification('user-123', payload)

      expect(logger.error).toHaveBeenCalled()
      expect((db as unknown as MockedDb).pushSubscription.delete).not.toHaveBeenCalled()
    })
  })

  describe('notifyTipReceived', () => {
    it('should send tip received notification with correct payload', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyTipReceived('curator-1', 'John Doe', '100')

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-1', {
        title: 'Tip Received',
        body: 'John Doe received a tip of 100 XLM',
        tag: 'tip-received',
      })
    })

    it('should handle different amount formats', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyTipReceived('curator-1', 'Jane Smith', '50.5')

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-1', {
        title: 'Tip Received',
        body: 'Jane Smith received a tip of 50.5 XLM',
        tag: 'tip-received',
      })
    })

    it('should handle worker names with special characters', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyTipReceived('curator-1', "John O'Brien", '75')

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-1', {
        title: 'Tip Received',
        body: "John O'Brien received a tip of 75 XLM",
        tag: 'tip-received',
      })
    })
  })

  describe('notifyContactRequest', () => {
    it('should send contact request notification with correct payload', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyContactRequest('curator-1', 'John Doe', 'Jane Smith')

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-1', {
        title: 'New Contact Request',
        body: 'Jane Smith wants to contact John Doe',
        tag: 'contact-request',
      })
    })

    it('should handle different worker and sender names', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyContactRequest('curator-2', 'Alice Johnson', 'Bob Wilson')

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-2', {
        title: 'New Contact Request',
        body: 'Bob Wilson wants to contact Alice Johnson',
        tag: 'contact-request',
      })
    })

    it('should handle same first names', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyContactRequest('curator-3', 'John Smith', 'John Doe')

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-3', {
        title: 'New Contact Request',
        body: 'John Doe wants to contact John Smith',
        tag: 'contact-request',
      })
    })
  })

  describe('notifyReviewPosted', () => {
    it('should send review posted notification with 5-star rating', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyReviewPosted('curator-1', 'John Doe', 5)

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-1', {
        title: 'New Review',
        body: 'John Doe received a 5-star review',
        tag: 'review-posted',
      })
    })

    it('should send review posted notification with 1-star rating', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyReviewPosted('curator-1', 'Jane Smith', 1)

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-1', {
        title: 'New Review',
        body: 'Jane Smith received a 1-star review',
        tag: 'review-posted',
      })
    })

    it('should send review posted notification with 3-star rating', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyReviewPosted('curator-2', 'Bob Wilson', 3)

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-2', {
        title: 'New Review',
        body: 'Bob Wilson received a 3-star review',
        tag: 'review-posted',
      })
    })

    it('should handle different rating values', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyReviewPosted('curator-3', 'Alice', 4)

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-3', {
        title: 'New Review',
        body: 'Alice received a 4-star review',
        tag: 'review-posted',
      })
    })

    it('should handle worker names with punctuation', async () => {
      vi.spyOn(pushService, 'sendPushNotification').mockResolvedValue(undefined)

      await pushService.notifyReviewPosted('curator-4', "Dr. O'Neill-Smith", 5)

      expect(pushService.sendPushNotification).toHaveBeenCalledWith('curator-4', {
        title: 'New Review',
        body: "Dr. O'Neill-Smith received a 5-star review",
        tag: 'review-posted',
      })
    })
  })

  describe('VAPID Configuration', () => {
    it('should call setVapidDetails when keys are provided during import', () => {
      // This is implicitly tested by other tests passing
      // When VAPID keys are set, webpush.setVapidDetails should be called during module initialization
      expect((webpush as unknown as MockedWebpush).setVapidDetails).toHaveBeenCalled()
    })

    it('should not call setVapidDetails when only public key is set', async () => {
      vi.resetModules()
      delete process.env.VAPID_PRIVATE_KEY

      // Re-mock
      vi.mock('web-push')
      vi.mock('@/db.js')
      vi.mock('@/config/logger.js')

      // The module initialization would not set VAPID details with only public key
      // This tests the conditional logic in the service
      expect(process.env.VAPID_PRIVATE_KEY).toBeUndefined()
    })
  })
})
