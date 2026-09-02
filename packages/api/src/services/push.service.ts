import webpush from 'web-push'

import { logger } from '../config/logger.js'
import { db } from '../db.js'

const vapidPublicKey = process.env.VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails('mailto:support@bluecollar.app', vapidPublicKey, vapidPrivateKey)
}

export interface PushNotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
}

export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload
): Promise<void> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    logger.warn('[PushService] VAPID keys not configured, skipping push notification')
    return
  }

  const subscriptions = await db.pushSubscription.findMany({ where: { userId } })

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { auth: sub.auth, p256dh: sub.p256dh },
        },
        JSON.stringify(payload)
      )
    } catch (error) {
      logger.error({ err: error }, '[PushService] error sending notification')
      // Remove invalid subscription
      if (error instanceof Error && error.message.includes('410')) {
        await db.pushSubscription.delete({ where: { id: sub.id } })
      }
    }
  }
}

export async function notifyTipReceived(
  curatorId: string,
  workerName: string,
  amount: string
): Promise<void> {
  await sendPushNotification(curatorId, {
    title: 'Tip Received',
    body: `${workerName} received a tip of ${amount} XLM`,
    tag: 'tip-received',
  })
}

export async function notifyContactRequest(
  curatorId: string,
  workerName: string,
  senderName: string
): Promise<void> {
  await sendPushNotification(curatorId, {
    title: 'New Contact Request',
    body: `${senderName} wants to contact ${workerName}`,
    tag: 'contact-request',
  })
}

export async function notifyReviewPosted(
  curatorId: string,
  workerName: string,
  rating: number
): Promise<void> {
  await sendPushNotification(curatorId, {
    title: 'New Review',
    body: `${workerName} received a ${rating}-star review`,
    tag: 'review-posted',
  })
}
