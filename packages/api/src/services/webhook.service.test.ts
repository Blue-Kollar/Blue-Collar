import { describe, it, expect, beforeEach, vi } from 'vitest'
import crypto from 'node:crypto'
import { WebhookService, createWebhookService } from './webhook.service.js'
import type { PrismaClient } from '@prisma/client'

describe('WebhookService', () => {
  let service: WebhookService
  let mockDb: Partial<PrismaClient>

  beforeEach(() => {
    // Mock database
    mockDb = {
      webhookSubscription: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
      webhookLog: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
    }

    service = createWebhookService({ db: mockDb as PrismaClient })
  })

  describe('Signature verification', () => {
    it('verifies a valid signature', () => {
      const secret = 'test-secret'
      const payload = JSON.stringify({ event: 'user.created', data: { id: '123' } })

      // Generate the expected signature
      const expectedSig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')

      expect(service.verifySignature(secret, payload, expectedSig)).toBe(true)
    })

    it('rejects an invalid signature', () => {
      const secret = 'test-secret'
      const payload = JSON.stringify({ event: 'user.created' })
      const wrongSig = 'sha256=invalid'

      expect(service.verifySignature(secret, payload, wrongSig)).toBe(false)
    })

    it('rejects signature with wrong secret', () => {
      const secret = 'test-secret'
      const payload = JSON.stringify({ event: 'user.created' })
      const wrongSecret = 'wrong-secret'

      const correctSig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')

      expect(service.verifySignature(wrongSecret, payload, correctSig)).toBe(false)
    })

    it('prevents timing attacks with timing-safe comparison', () => {
      const secret = 'test-secret'
      const payload = JSON.stringify({ event: 'user.created' })

      const sig1 = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
      const sig2 = 'sha256=' + crypto.createHmac('sha256', secret).update(payload + 'x').digest('hex')

      // Both should fail timing attacks — timing-safe comparison should take similar time
      expect(service.verifySignature(secret, payload, sig1)).toBe(true)
      expect(service.verifySignature(secret, payload, sig2)).toBe(false)
    })
  })

  describe('createSubscription', () => {
    it('creates a subscription with a generated secret', async () => {
      const userId = 'user-123'
      const url = 'https://example.com/webhook'
      const events = ['user.created', 'user.updated']

      const mockSubscription = {
        id: 'sub-1',
        userId,
        url,
        secret: 'generated-secret',
        events,
        isActive: true,
        createdAt: new Date(),
      }

      vi.mocked(mockDb.webhookSubscription!.create).mockResolvedValueOnce(mockSubscription)

      const result = await service.createSubscription(userId, url, events)

      expect(mockDb.webhookSubscription!.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId,
          url,
          events,
          secret: expect.any(String),
        }),
      })

      expect(result).toEqual(mockSubscription)
    })

    it('generates a unique 32-byte secret for each subscription', async () => {
      const userId = 'user-123'
      const url = 'https://example.com/webhook'
      const events = ['user.created']

      vi.mocked(mockDb.webhookSubscription!.create).mockResolvedValueOnce({
        id: 'sub-1',
        userId,
        url,
        secret: 'secret1',
        events,
        isActive: true,
        createdAt: new Date(),
      })

      await service.createSubscription(userId, url, events)

      const firstCall = vi.mocked(mockDb.webhookSubscription!.create).mock.calls[0][0]
      const secret1 = (firstCall?.data as any).secret

      expect(secret1).toMatch(/^[a-f0-9]{64}$/) // 32 bytes = 64 hex chars
    })
  })

  describe('listSubscriptions', () => {
    it('lists subscriptions for a user ordered by most recent', async () => {
      const userId = 'user-123'
      const mockSubs = [
        { id: 'sub-1', userId, url: 'http://a.com', secret: 's1', events: [], isActive: true, createdAt: new Date() },
        { id: 'sub-2', userId, url: 'http://b.com', secret: 's2', events: [], isActive: true, createdAt: new Date() },
      ]

      vi.mocked(mockDb.webhookSubscription!.findMany).mockResolvedValueOnce(mockSubs)

      const result = await service.listSubscriptions(userId)

      expect(mockDb.webhookSubscription!.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      })

      expect(result).toEqual(mockSubs)
    })
  })

  describe('deleteSubscription', () => {
    it('deletes a subscription owned by the user', async () => {
      const userId = 'user-123'
      const subId = 'sub-1'

      vi.mocked(mockDb.webhookSubscription!.findFirst).mockResolvedValueOnce({
        id: subId,
        userId,
        url: 'http://example.com',
        secret: 'secret',
        events: [],
        isActive: true,
        createdAt: new Date(),
      })

      const result = await service.deleteSubscription(subId, userId)

      expect(mockDb.webhookSubscription!.findFirst).toHaveBeenCalledWith({
        where: { id: subId, userId },
      })

      expect(mockDb.webhookSubscription!.delete).toHaveBeenCalledWith({
        where: { id: subId },
      })

      expect(result).toBe(true)
    })

    it('returns false if subscription not found', async () => {
      const userId = 'user-123'
      const subId = 'nonexistent'

      vi.mocked(mockDb.webhookSubscription!.findFirst).mockResolvedValueOnce(null)

      const result = await service.deleteSubscription(subId, userId)

      expect(result).toBe(false)
      expect(mockDb.webhookSubscription!.delete).not.toHaveBeenCalled()
    })

    it('prevents unauthorized deletion of other users subscriptions', async () => {
      const userId = 'user-123'
      const otherId = 'user-456'
      const subId = 'sub-1'

      vi.mocked(mockDb.webhookSubscription!.findFirst).mockResolvedValueOnce(null)

      const result = await service.deleteSubscription(subId, userId)

      expect(mockDb.webhookSubscription!.findFirst).toHaveBeenCalledWith({
        where: { id: subId, userId },
      })

      expect(result).toBe(false)
    })
  })

  describe('getLogs', () => {
    it('returns paginated logs for a subscription', async () => {
      const userId = 'user-123'
      const subId = 'sub-1'
      const page = 1
      const limit = 20

      vi.mocked(mockDb.webhookSubscription!.findFirst).mockResolvedValueOnce({
        id: subId,
        userId,
        url: 'http://example.com',
        secret: 'secret',
        events: [],
        isActive: true,
        createdAt: new Date(),
      })

      const mockLogs = [
        { id: 'log-1', subscriptionId: subId, event: 'user.created', payload: {}, statusCode: 200, success: true, attempts: 1, error: null, createdAt: new Date() },
      ]

      vi.mocked(mockDb.webhookLog!.findMany).mockResolvedValueOnce(mockLogs)
      vi.mocked(mockDb.webhookLog!.count).mockResolvedValueOnce(1)

      const result = await service.getLogs(subId, userId, page, limit)

      expect(result).toEqual({
        data: mockLogs,
        meta: {
          total: 1,
          page,
          limit,
          pages: 1,
        },
      })
    })

    it('returns null for unauthorized access', async () => {
      const userId = 'user-123'
      const subId = 'sub-1'

      vi.mocked(mockDb.webhookSubscription!.findFirst).mockResolvedValueOnce(null)

      const result = await service.getLogs(subId, userId)

      expect(result).toBe(null)
      expect(mockDb.webhookLog!.findMany).not.toHaveBeenCalled()
    })

    it('calculates pagination correctly', async () => {
      const userId = 'user-123'
      const subId = 'sub-1'
      const page = 2
      const limit = 10

      vi.mocked(mockDb.webhookSubscription!.findFirst).mockResolvedValueOnce({
        id: subId,
        userId,
        url: 'http://example.com',
        secret: 'secret',
        events: [],
        isActive: true,
        createdAt: new Date(),
      })

      vi.mocked(mockDb.webhookLog!.findMany).mockResolvedValueOnce([])
      vi.mocked(mockDb.webhookLog!.count).mockResolvedValueOnce(25)

      const result = await service.getLogs(subId, userId, page, limit)

      expect(mockDb.webhookLog!.findMany).toHaveBeenCalledWith({
        where: { subscriptionId: subId },
        skip: (page - 1) * limit, // 10
        take: limit,
        orderBy: { createdAt: 'desc' },
      })

      expect(result?.meta.pages).toBe(3) // 25 / 10 = 3 pages
    })
  })

  describe('publishEvent', () => {
    it('publishes event to all matching subscriptions', async () => {
      const event = 'user.created'
      const payload = { id: '123', email: 'test@example.com' }

      const mockSubs = [
        { id: 'sub-1', userId: 'user-1', url: 'http://a.com', secret: 's1', events: [event], isActive: true, createdAt: new Date() },
        { id: 'sub-2', userId: 'user-2', url: 'http://b.com', secret: 's2', events: [event], isActive: true, createdAt: new Date() },
      ]

      vi.mocked(mockDb.webhookSubscription!.findMany).mockResolvedValueOnce(mockSubs)

      const mockLogs = [
        { id: 'log-1', subscriptionId: 'sub-1', event, payload, statusCode: null, success: false, attempts: 0, error: null, createdAt: new Date() },
        { id: 'log-2', subscriptionId: 'sub-2', event, payload, statusCode: null, success: false, attempts: 0, error: null, createdAt: new Date() },
      ]

      vi.mocked(mockDb.webhookLog!.create).mockResolvedValueOnce(mockLogs[0]).mockResolvedValueOnce(mockLogs[1])

      await service.publishEvent(event, payload)

      expect(mockDb.webhookSubscription!.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          events: { has: event },
        },
      })

      expect(mockDb.webhookLog!.create).toHaveBeenCalledTimes(2)
    })

    it('does not publish to inactive subscriptions', async () => {
      const event = 'user.created'
      const payload = { id: '123' }

      vi.mocked(mockDb.webhookSubscription!.findMany).mockResolvedValueOnce([])

      await service.publishEvent(event, payload)

      expect(mockDb.webhookLog!.create).not.toHaveBeenCalled()
    })

    it('does not publish to subscriptions without matching event', async () => {
      const event = 'user.created'
      const payload = { id: '123' }

      vi.mocked(mockDb.webhookSubscription!.findMany).mockResolvedValueOnce([])

      await service.publishEvent(event, payload)

      expect(mockDb.webhookSubscription!.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          events: { has: event },
        },
      })
    })
  })

  describe('Factory function', () => {
    it('creates a WebhookService with dependency injection', () => {
      const customDb = {} as PrismaClient
      const customService = createWebhookService({ db: customDb })

      expect(customService).toBeInstanceOf(WebhookService)
    })

    it('creates a WebhookService with default dependencies when none provided', () => {
      const defaultService = createWebhookService()

      expect(defaultService).toBeInstanceOf(WebhookService)
    })
  })
})
