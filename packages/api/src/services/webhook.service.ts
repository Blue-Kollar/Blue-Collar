import crypto from 'node:crypto'

import type { PrismaClient } from '@prisma/client'

import { logger } from '../config/logger.js'
import { db as defaultDb } from '../db.js'
import { getErrorMessage } from '../utils/getErrorMessage.js'

interface WebhookServiceDeps {
  db?: PrismaClient
}

const MAX_ATTEMPTS = 3
const RETRY_DELAYS = [5_000, 30_000, 120_000] // 5s, 30s, 2min

/**
 * WebhookService encapsulates webhook signature verification, payload processing,
 * and delivery with retry logic.
 */
export class WebhookService {
  private db: PrismaClient
  private maxAttempts = MAX_ATTEMPTS
  private retryDelays = RETRY_DELAYS

  constructor(deps?: WebhookServiceDeps) {
    this.db = deps?.db ?? defaultDb
  }

  /**
   * Sign a payload with HMAC-SHA256.
   * Used for both outgoing webhook signatures and verification.
   */
  private sign(secret: string, payload: string): string {
    return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
  }

  /**
   * Verify an incoming webhook signature using timing-safe comparison.
   * Prevents timing attacks on signature verification.
   */
  verifySignature(secret: string, payload: string, signature: string): boolean {
    const expected = this.sign(secret, payload)
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    } catch {
      return false
    }
  }

  /**
   * Deliver a webhook to a subscriber with exponential backoff retry logic.
   * Retries up to MAX_ATTEMPTS times with increasing delays between attempts.
   */
  private async deliver(
    logId: string,
    url: string,
    secret: string,
    event: string,
    payload: object,
    attempt = 0,
  ): Promise<void> {
    const body = JSON.stringify(payload)
    const signature = this.sign(secret, body)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-BlueCollar-Event': event,
          'X-BlueCollar-Signature': signature,
          'X-BlueCollar-Delivery': logId,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      })

      await this.db.webhookLog.update({
        where: { id: logId },
        data: {
          statusCode: res.status,
          success: res.ok,
          attempts: attempt + 1,
          error: res.ok ? null : `HTTP ${res.status}`,
        },
      })

      if (!res.ok && attempt < this.maxAttempts - 1) {
        setTimeout(
          () => this.deliver(logId, url, secret, event, payload, attempt + 1),
          this.retryDelays[attempt],
        )
      }
    } catch (err) {
      await this.db.webhookLog.update({
        where: { id: logId },
        data: {
          attempts: attempt + 1,
          error: getErrorMessage(err),
        },
      })

      if (attempt < this.maxAttempts - 1) {
        setTimeout(
          () => this.deliver(logId, url, secret, event, payload, attempt + 1),
          this.retryDelays[attempt],
        )
      }
    }
  }

  /**
   * Publish an event to all matching active subscriptions.
   * Asynchronously delivers webhooks to each subscriber without blocking.
   */
  async publishEvent(event: string, payload: object): Promise<void> {
    const subscriptions = await this.db.webhookSubscription.findMany({
      where: {
        isActive: true,
        events: { has: event },
      },
    })

    for (const sub of subscriptions) {
      const log = await this.db.webhookLog.create({
        data: {
          subscriptionId: sub.id,
          event,
          payload,
        },
      })

      this.deliver(log.id, sub.url, sub.secret, event, payload).catch((err) =>
        logger.error({ err }, 'Webhook delivery error'),
      )
    }
  }

  /**
   * Create a new webhook subscription for a user.
   * Generates a secure random secret for signature verification.
   */
  async createSubscription(userId: string, url: string, events: string[]) {
    const secret = crypto.randomBytes(32).toString('hex')
    return this.db.webhookSubscription.create({
      data: {
        userId,
        url,
        secret,
        events,
      },
    })
  }

  /**
   * List all subscriptions for a user, ordered by most recent first.
   */
  async listSubscriptions(userId: string) {
    return this.db.webhookSubscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Delete a subscription, only if owned by the specified user.
   * Returns true if deleted, false if not found or unauthorized.
   */
  async deleteSubscription(id: string, userId: string): Promise<boolean> {
    const sub = await this.db.webhookSubscription.findFirst({
      where: { id, userId },
    })

    if (!sub) return false

    await this.db.webhookSubscription.delete({ where: { id } })
    return true
  }

  /**
   * Get paginated webhook delivery logs for a subscription.
   * Only accessible by the subscription owner.
   * Returns null if subscription not found or unauthorized.
   */
  async getLogs(subscriptionId: string, userId: string, page = 1, limit = 20) {
    const sub = await this.db.webhookSubscription.findFirst({
      where: { id: subscriptionId, userId },
    })

    if (!sub) return null

    const where = { subscriptionId }
    const [logs, total] = await Promise.all([
      this.db.webhookLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.db.webhookLog.count({ where }),
    ])

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    }
  }
}

/**
 * Factory function to create a WebhookService with dependency injection.
 * Allows for easier testing and alternative implementations.
 */
export function createWebhookService(deps?: WebhookServiceDeps): WebhookService {
  return new WebhookService(deps)
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createWebhookService()

/** Backward-compatible module-level exports */
export const verifySignature = (secret: string, payload: string, signature: string) =>
  _defaultService.verifySignature(secret, payload, signature)

export const publishEvent = (event: string, payload: object) =>
  _defaultService.publishEvent(event, payload)

export const createSubscription = (userId: string, url: string, events: string[]) =>
  _defaultService.createSubscription(userId, url, events)

export const listSubscriptions = (userId: string) => _defaultService.listSubscriptions(userId)

export const deleteSubscription = (id: string, userId: string) =>
  _defaultService.deleteSubscription(id, userId)

export const getLogs = (subscriptionId: string, userId: string, page?: number, limit?: number) =>
  _defaultService.getLogs(subscriptionId, userId, page, limit)
