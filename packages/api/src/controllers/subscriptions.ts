import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { ErrorMessages } from '../constants/errors.js'
import { db } from '../db.js'

// Tier feature gates
const TIER_FEATURES: Record<string, string[]> = {
  free: ['basic_listing'],
  pro: ['basic_listing', 'portfolio', 'priority_search'],
  premium: ['basic_listing', 'portfolio', 'priority_search', 'analytics', 'featured_badge'],
}

export const getSubscription = catchAsync(async (req: Request, res: Response) => {
  const sub = await db.subscription.findUnique({
    where: { workerId: req.params.workerId },
  })
  if (!sub) {
    throw new AppError(ErrorMessages.SUBSCRIPTION_NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }
  return res.json({ data: { ...sub, features: TIER_FEATURES[sub.tier] }, status: 'success', code: 200 })
})

export const createOrUpgradeSubscription = catchAsync(async (req: Request, res: Response) => {
  const { workerId } = req.params
  const { tier, stripeCustomerId, stripeSubId, currentPeriodEnd } = req.body

  if (!tier || !['free', 'pro', 'premium'].includes(tier)) {
    throw new AppError(ErrorMessages.SUBSCRIPTION_TIER_INVALID, 400, true, ErrorCode.VALIDATION_ERROR)
  }

  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) {
    throw new AppError(ErrorMessages.WORKER_NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }

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
})

export const cancelSubscription = catchAsync(async (req: Request, res: Response) => {
  const sub = await db.subscription.findUnique({ where: { workerId: req.params.workerId } })
  if (!sub) {
    throw new AppError(ErrorMessages.SUBSCRIPTION_NOT_FOUND, 404, true, ErrorCode.NOT_FOUND)
  }

  const updated = await db.subscription.update({
    where: { workerId: req.params.workerId },
    data: { cancelAtPeriodEnd: true },
  })
  return res.json({ data: updated, status: 'success', code: 200 })
})

// Stripe webhook: handle subscription renewal / expiry
export const stripeWebhook = catchAsync(async (req: Request, res: Response) => {
  const event = req.body
  if (event.type === 'invoice.payment_succeeded') {
    const { subscription: stripeSubId, lines } = event.data.object
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
  return res.json({ status: 'success', code: 200, message: 'Webhook received' })
})
