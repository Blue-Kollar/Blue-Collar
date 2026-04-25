import crypto from 'node:crypto'
import { db } from '../db.js'
import { logger } from '../config/logger.js'

const MAX_ATTEMPTS = 3
const RETRY_DELAYS = [5_000, 30_000, 120_000] // 5s, 30s, 2min

/** Sign a payload with HMAC-SHA256 */
function sign(secret: string, payload: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

/** Deliver a webhook with retries */
async function deliver(logId: string, url: string, secret: string, event: string, payload: object, attempt = 0) {
  const body = JSON.stringify(payload)
  const signature = sign(secret, body)

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

    await db.webhookLog.update({
      where: { id: logId },
      data: { statusCode: res.status, success: res.ok, attempts: attempt + 1, error: res.ok ? null : `HTTP ${res.status}` },
    })

    if (!res.ok && attempt < MAX_ATTEMPTS - 1) {
      setTimeout(() => deliver(logId, url, secret, event, payload, attempt + 1), RETRY_DELAYS[attempt])
    }
  } catch (err: any) {
    await db.webhookLog.update({
      where: { id: logId },
      data: { attempts: attempt + 1, error: err?.message ?? 'Unknown error' },
    })
    if (attempt < MAX_ATTEMPTS - 1) {
      setTimeout(() => deliver(logId, url, secret, event, payload, attempt + 1), RETRY_DELAYS[attempt])
    }
  }
}

/** Publish an event to all matching active subscriptions */
export async function publishEvent(event: string, payload: object) {
  const subscriptions = await db.webhookSubscription.findMany({
    where: { isActive: true, events: { has: event } },
  })

  for (const sub of subscriptions) {
    const log = await db.webhookLog.create({
      data: { subscriptionId: sub.id, event, payload },
    })
    deliver(log.id, sub.url, sub.secret, event, payload).catch((err) =>
      logger.error({ err }, 'Webhook delivery error'),
    )
  }
}

/** Create a webhook subscription */
export async function createSubscription(userId: string, url: string, events: string[]) {
  const secret = crypto.randomBytes(32).toString('hex')
  return db.webhookSubscription.create({ data: { userId, url, secret, events } })
}

/** List subscriptions for a user */
export async function listSubscriptions(userId: string) {
  return db.webhookSubscription.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } })
}

/** Delete a subscription (only owner) */
export async function deleteSubscription(id: string, userId: string) {
  const sub = await db.webhookSubscription.findFirst({ where: { id, userId } })
  if (!sub) return null
  await db.webhookSubscription.delete({ where: { id } })
  return true
}

/** Get webhook logs for a subscription */
export async function getLogs(subscriptionId: string, userId: string, page = 1, limit = 20) {
  const sub = await db.webhookSubscription.findFirst({ where: { id: subscriptionId, userId } })
  if (!sub) return null

  const where = { subscriptionId }
  const [logs, total] = await Promise.all([
    db.webhookLog.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' } }),
    db.webhookLog.count({ where }),
  ])
  return { data: logs, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

/** Verify an incoming webhook signature */
export function verifySignature(secret: string, payload: string, signature: string): boolean {
  const expected = sign(secret, payload)
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  } catch {
    return false
  }
}
