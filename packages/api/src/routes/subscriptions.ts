import { Router } from 'express'
import {
  getSubscription,
  createOrUpgradeSubscription,
  cancelSubscription,
  stripeWebhook,
} from '../controllers/subscriptions.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

// Stripe webhook (raw body, no auth)
router.post('/webhook', stripeWebhook)

// Worker subscription management (curator or admin)
router.get('/:workerId', authenticate, authorize('curator', 'admin'), getSubscription)
router.post('/:workerId', authenticate, authorize('curator', 'admin'), createOrUpgradeSubscription)
router.delete('/:workerId', authenticate, authorize('curator', 'admin'), cancelSubscription)

export default router
