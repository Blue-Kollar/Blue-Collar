import type { Request, Response } from 'express'
import { db } from '../db.js'

// Tier feature gates
const TIER_FEATURES: Record<string, string[]> = {
  free: ['basic_listing'],
  pro: ['basic_listing', 'portfolio', 'priority_search'],
  premium: ['basic_listing', 'portfolio', 'priority_search', 'analytics', 'featured_badge'],
}

export async function getSubscription(req: Request, res: Response) {
  const sub = await db.subscription.findUnique({
    where: { workerId: req.params.workerId },
  })
  if (!sub) return res.status(404).json({ status: 'error', message: 'No subscription found', code: 404 })
  return res.json({ data: { ...sub, features: TIER_FEATURES[sub.tier] }, status: 'success', code: 200 })
}

export async function createOrUpgradeSubscription(req: Request, res: Response) {
  const { workerId } = req.params
  const { tier, stripeCustomerId, stripeSubId, currentPeriodEnd } = req.body

  if (!tier || !['free', 'pro', 'premium'].includes(tier))
    return res.status(400).json({ status: 'error', message: 'tier must be free, pro, or premium', code: 400 })

  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) return res.status(404).json({ status: 'error', message: 'Worker not found', code: 404 })

  const sub = await db.subscription.upsert({
    where: { workerId },
    create: {
      workerId,
      tier,
      stripeCustomerId,
      stripeSubId,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
    },
    update: {
      tier,
      stripeCustomerId,
      stripeSubId,
      currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
      cancelAtPeriodEnd: false,
    },
  })
  return res.status(201).json({ data: { ...sub, features: TIER_FEATURES[sub.tier] }, status: 'success', code: 201 })
}

export async function cancelSubscription(req: Request, res: Response) {
  const sub = await db.subscription.findUnique({ where: { workerId: req.params.workerId } })
  if (!sub) return res.status(404).json({ status: 'error', message: 'No subscription found', code: 404 })

  const updated = await db.subscription.update({
    where: { workerId: req.params.workerId },
    data: { cancelAtPeriodEnd: true },
  })
  return res.json({ data: updated, status: 'success', code: 200 })
}

// Stripe webhook: handle subscription renewal / expiry
export async function stripeWebhook(req: Request, res: Response) {
  const event = req.body
  if (event.type === 'invoice.payment_succeeded') {
    const { subscription: stripeSubId, customer: stripeCustomerId, lines } = event.data.object
    const periodEnd = lines?.data?.[0]?.period?.end
    await db.subscription.updateMany({
      where: { stripeSubId },
      data: {
        cancelAtPeriodEnd: false,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
      },
    })
  } else if (event.type === 'customer.subscription.deleted') {
    const { id: stripeSubId } = event.data.object
    await db.subscription.updateMany({
      where: { stripeSubId },
      data: { tier: 'free', stripeSubId: null, currentPeriodEnd: null, cancelAtPeriodEnd: false },
    })
  }
  return res.json({ received: true })
}
