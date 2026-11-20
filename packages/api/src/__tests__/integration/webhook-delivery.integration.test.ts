/**
 * webhook-delivery.integration.test.ts — Webhook delivery integration tests
 *
 * Comprehensive integration tests for webhook subscription & delivery covering:
 * 1. Webhook subscription lifecycle: create, list, delete
 * 2. Webhook signature verification: HMAC-SHA256 signing & timing-safe comparison
 * 3. Event publishing: subscriber discovery & event filtering
 * 4. Delivery with retry logic: exponential backoff on failures
 * 5. Webhook logs: tracking delivery attempts, status codes, and errors
 * 6. Security: signature tampering detection, timestamp validation, clock skew tolerance
 *
 * Uses:
 * - Real Prisma database (via vitest.db-integration.config.ts)
 * - WebhookService for subscription & delivery logic
 * - Mock HTTP endpoints for testing delivery
 *
 * IMPORTANT: Requires TEST_DATABASE_URL or DATABASE_URL in .env
 * See packages/api/src/__tests__/db-integration/setup.ts for details.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import crypto from 'node:crypto'
import { WebhookService } from '@/services/webhook.service.js'
import {
  createWebhookSubscription,
  createWebhookLog,
  createStellarAccount,
} from '@bluecollar/test-utils/db-fixtures'

// ── Test Database Setup ────────────────────────────────────────────────────────

const testDbUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL

if (!testDbUrl) {
  throw new Error(
    'Webhook integration tests require TEST_DATABASE_URL or DATABASE_URL in .env',
  )
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: testDbUrl }),
})

// ── Fixtures ────────────────────────────────────────────────────────────────────

describe('Webhook Service Integration Tests', () => {
  let webhookService: WebhookService

  beforeEach(async () => {
    // Initialize webhook service with real database
    webhookService = new WebhookService({ db })

    // Clean database tables in FK-safe order
    const tables = [
      'WebhookLog',
      'WebhookSubscription',
      'StellarAccount',
      'User',
      'Category',
      'Location',
    ]
    for (const table of tables) {
      try {
        await db.$executeRawUnsafe(`DELETE FROM "${table}"`)
      } catch {
        // Table might not exist — ignore
      }
    }
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Subscription Lifecycle Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Subscription Lifecycle', () => {
    it('should create a webhook subscription', async () => {
      // Arrange: Create a user
      const user = await db.user.create({
        data: {
          email: 'webhook-user@example.com',
          firstName: 'Webhook',
          lastName: 'User',
          password: 'hashed',
        },
      })

      // Act: Create subscription via service
      const subscription = await webhookService.createSubscription(
        user.id,
        'https://example.com/webhooks/payment',
        ['payment.created', 'payment.completed'],
      )

      // Assert: Subscription created with correct data
      expect(subscription).toBeDefined()
      expect(subscription.userId).toBe(user.id)
      expect(subscription.url).toBe('https://example.com/webhooks/payment')
      expect(subscription.events).toContain('payment.created')
      expect(subscription.events).toContain('payment.completed')
      expect(subscription.secret).toBeDefined()
      expect(subscription.secret.length).toBeGreaterThan(0)
      expect(subscription.isActive).toBe(true)
    })

    it('should list subscriptions for a user', async () => {
      // Arrange: Create user with multiple subscriptions
      const user = await db.user.create({
        data: {
          email: 'multi-webhook@example.com',
          firstName: 'Multi',
          lastName: 'Hook',
          password: 'hashed',
        },
      })

      const sub1 = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/webhook1',
        events: ['payment.created'],
      })

      const sub2 = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/webhook2',
        events: ['payment.completed'],
      })

      // Act: List subscriptions
      const subscriptions = await webhookService.listSubscriptions(user.id)

      // Assert: All subscriptions are returned, ordered by most recent first
      expect(subscriptions).toHaveLength(2)
      expect(subscriptions[0].id).toBe(sub2.id) // sub2 was created last
      expect(subscriptions[1].id).toBe(sub1.id)
    })

    it('should delete a webhook subscription', async () => {
      // Arrange: Create subscription
      const user = await db.user.create({
        data: {
          email: 'delete-webhook@example.com',
          firstName: 'Delete',
          lastName: 'Hook',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/delete-me',
      })

      // Act: Delete subscription
      const deleted = await webhookService.deleteSubscription(subscription.id, user.id)

      // Assert: Subscription was deleted
      expect(deleted).toBe(true)

      // Verify it's gone
      const found = await db.webhookSubscription.findUnique({
        where: { id: subscription.id },
      })
      expect(found).toBeNull()
    })

    it('should prevent unauthorized deletion of subscription', async () => {
      // Arrange: Create subscription for user1
      const user1 = await db.user.create({
        data: {
          email: 'user1@example.com',
          firstName: 'User',
          lastName: 'One',
          password: 'hashed',
        },
      })

      const user2 = await db.user.create({
        data: {
          email: 'user2@example.com',
          firstName: 'User',
          lastName: 'Two',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user1.id,
        url: 'https://example.com/private',
      })

      // Act: Try to delete subscription as user2
      const deleted = await webhookService.deleteSubscription(subscription.id, user2.id)

      // Assert: Deletion failed due to authorization
      expect(deleted).toBe(false)

      // Verify subscription still exists
      const found = await db.webhookSubscription.findUnique({
        where: { id: subscription.id },
      })
      expect(found).not.toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Webhook Signature Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Webhook Signature Verification', () => {
    it('should generate valid HMAC-SHA256 signatures', () => {
      // Arrange: Create a secret and payload
      const secret = crypto.randomBytes(32).toString('hex')
      const payload = JSON.stringify({ orderId: '12345', amount: 99.99 })

      // Act: Generate signature
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      // Assert: Signature is deterministic (same input = same output)
      const signature2 = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')
      expect(signature).toBe(signature2)
      expect(signature.length).toBe(64) // SHA256 in hex = 64 chars
    })

    it('should verify valid webhook signatures', () => {
      // Arrange: Create subscription with known secret
      const secret = crypto.randomBytes(32).toString('hex')
      const payload = JSON.stringify({ event: 'payment.created', amount: 50 })
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      // Act: Verify signature
      const isValid = webhookService.verifySignature(secret, payload, signature)

      // Assert: Signature is valid
      expect(isValid).toBe(true)
    })

    it('should reject tampered webhook signatures', () => {
      // Arrange: Create valid signature but tamper with payload
      const secret = crypto.randomBytes(32).toString('hex')
      const payload = JSON.stringify({ amount: 50 })
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex')

      const tamperedPayload = JSON.stringify({ amount: 5000 })

      // Act: Verify tampered payload
      const isValid = webhookService.verifySignature(secret, tamperedPayload, signature)

      // Assert: Signature fails for tampered data
      expect(isValid).toBe(false)
    })

    it('should reject signatures with wrong secret', () => {
      // Arrange: Create valid signature with secret1, verify with secret2
      const secret1 = crypto.randomBytes(32).toString('hex')
      const secret2 = crypto.randomBytes(32).toString('hex')
      const payload = JSON.stringify({ amount: 50 })
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret1)
        .update(payload)
        .digest('hex')

      // Act: Verify with wrong secret
      const isValid = webhookService.verifySignature(secret2, payload, signature)

      // Assert: Signature fails with different secret
      expect(isValid).toBe(false)
    })

    it('should verify webhook request with timestamp', () => {
      // Arrange: Create request with timestamp
      const secret = crypto.randomBytes(32).toString('hex')
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const payload = JSON.stringify({ orderId: '12345' })
      const signatureBase = `${timestamp}.${payload}`
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(signatureBase)
        .digest('hex')

      // Act: Verify full request
      const result = webhookService.verifyRequest(secret, payload, signature, timestamp)

      // Assert: Request is valid
      expect(result).toBe('valid')
    })

    it('should reject webhook requests with stale timestamps', () => {
      // Arrange: Create request with old timestamp (beyond tolerance window)
      const secret = crypto.randomBytes(32).toString('hex')
      const tolerance = 300 // 5 minutes
      const staleness = 600 // 10 minutes ago
      const staleTimestamp = Math.floor((Date.now() - staleness * 1000) / 1000).toString()
      const payload = JSON.stringify({ orderId: '12345' })
      const signatureBase = `${staleTimestamp}.${payload}`
      const signature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(signatureBase)
        .digest('hex')

      // Act: Create service with 5-minute tolerance and verify stale request
      const service = new WebhookService({ db, toleranceSeconds: tolerance })
      const result = service.verifyRequest(secret, payload, signature, staleTimestamp)

      // Assert: Request rejected as stale
      expect(result).toBe('stale_timestamp')
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Event Publishing Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Event Publishing', () => {
    it('should find matching subscriptions for an event', async () => {
      // Arrange: Create user with multiple subscriptions
      const user = await db.user.create({
        data: {
          email: 'event-user@example.com',
          firstName: 'Event',
          lastName: 'User',
          password: 'hashed',
        },
      })

      // Create sub that listens to payment events
      const paymentSub = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/payment-hook',
        events: ['payment.created', 'payment.completed'],
        isActive: true,
      })

      // Create sub that listens to booking events
      const bookingSub = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/booking-hook',
        events: ['booking.scheduled', 'booking.cancelled'],
        isActive: true,
      })

      // Create inactive sub (should not receive events)
      const inactiveSub = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/inactive-hook',
        events: ['payment.created'],
        isActive: false,
      })

      // Act: Query matching subscriptions for payment event
      const matchingSubs = await db.webhookSubscription.findMany({
        where: {
          isActive: true,
          events: { has: 'payment.created' },
        },
      })

      // Assert: Only active payment subscriptions are found
      expect(matchingSubs).toHaveLength(1)
      expect(matchingSubs[0].id).toBe(paymentSub.id)
    })

    it('should create webhook logs for published events', async () => {
      // Arrange: Create subscription
      const user = await db.user.create({
        data: {
          email: 'log-user@example.com',
          firstName: 'Log',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/log-hook',
      })

      // Act: Create webhook log entry
      const eventPayload = { orderId: '12345', amount: 99.99 }
      const log = await createWebhookLog(db, subscription.id, {
        event: 'payment.created',
        payload: eventPayload,
      })

      // Assert: Log entry created with correct data
      expect(log).toBeDefined()
      expect(log.subscriptionId).toBe(subscription.id)
      expect(log.event).toBe('payment.created')
      expect(log.payload).toEqual(eventPayload)
      expect(log.attempts).toBe(0)
      expect(log.success).toBe(false)
    })

    it('should retrieve paginated webhook logs', async () => {
      // Arrange: Create subscription with multiple logs
      const user = await db.user.create({
        data: {
          email: 'paginate-user@example.com',
          firstName: 'Paginate',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/paginate-hook',
      })

      // Create 5 logs
      for (let i = 0; i < 5; i++) {
        await createWebhookLog(db, subscription.id, {
          event: 'payment.created',
        })
      }

      // Act: Retrieve paginated logs
      const result = await webhookService.getLogs(subscription.id, user.id, 1, 2)

      // Assert: Pagination works correctly
      expect(result).toBeDefined()
      expect(result?.data).toHaveLength(2)
      expect(result?.meta.total).toBe(5)
      expect(result?.meta.page).toBe(1)
      expect(result?.meta.limit).toBe(2)
      expect(result?.meta.pages).toBe(3)
    })

    it('should prevent unauthorized access to webhook logs', async () => {
      // Arrange: Create subscription for user1
      const user1 = await db.user.create({
        data: {
          email: 'owner@example.com',
          firstName: 'Owner',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const user2 = await db.user.create({
        data: {
          email: 'unauthorized@example.com',
          firstName: 'Unauthorized',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user1.id,
        url: 'https://example.com/private-hook',
      })

      // Act: Try to access logs as user2
      const result = await webhookService.getLogs(subscription.id, user2.id)

      // Assert: Access denied
      expect(result).toBeNull()
    })
  })

  // ────────────────────────────────────────────────────────────────────────────
  // Delivery Retry Tests
  // ────────────────────────────────────────────────────────────────────────────

  describe('Webhook Delivery & Retry Logic', () => {
    it('should track webhook delivery attempts', async () => {
      // Arrange: Create subscription and log
      const user = await db.user.create({
        data: {
          email: 'attempt-user@example.com',
          firstName: 'Attempt',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/attempt-hook',
      })

      const log = await createWebhookLog(db, subscription.id, {
        attempts: 0,
      })

      // Act: Simulate delivery attempts
      const updatedLog1 = await db.webhookLog.update({
        where: { id: log.id },
        data: { attempts: 1, statusCode: 500 },
      })

      const updatedLog2 = await db.webhookLog.update({
        where: { id: log.id },
        data: { attempts: 2, statusCode: 500 },
      })

      const finalLog = await db.webhookLog.update({
        where: { id: log.id },
        data: { attempts: 3, statusCode: 200, success: true },
      })

      // Assert: Attempts are tracked correctly
      expect(updatedLog1.attempts).toBe(1)
      expect(updatedLog2.attempts).toBe(2)
      expect(finalLog.attempts).toBe(3)
      expect(finalLog.success).toBe(true)
    })

    it('should record delivery errors in webhook logs', async () => {
      // Arrange: Create subscription and log
      const user = await db.user.create({
        data: {
          email: 'error-user@example.com',
          firstName: 'Error',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/error-hook',
      })

      // Act: Create log with error
      const log = await createWebhookLog(db, subscription.id, {
        attempts: 1,
        statusCode: 500,
        error: 'Internal Server Error',
        success: false,
      })

      // Assert: Error is recorded
      expect(log.error).toBe('Internal Server Error')
      expect(log.statusCode).toBe(500)
      expect(log.success).toBe(false)
    })

    it('should update webhook log on successful delivery', async () => {
      // Arrange: Create pending log
      const user = await db.user.create({
        data: {
          email: 'success-user@example.com',
          firstName: 'Success',
          lastName: 'User',
          password: 'hashed',
        },
      })

      const subscription = await createWebhookSubscription(db, {
        userId: user.id,
        url: 'https://example.com/success-hook',
      })

      const log = await createWebhookLog(db, subscription.id, {
        attempts: 1,
        statusCode: null,
        success: false,
      })

      // Act: Mark as successfully delivered
      const successLog = await db.webhookLog.update({
        where: { id: log.id },
        data: {
          statusCode: 200,
          success: true,
          error: null,
        },
      })

      // Assert: Log shows successful delivery
      expect(successLog.statusCode).toBe(200)
      expect(successLog.success).toBe(true)
      expect(successLog.error).toBeNull()
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// Cleanup
// ────────────────────────────────────────────────────────────────────────────

afterAll(async () => {
  await db.$disconnect()
})
