import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { publicReadRateLimiter } from '../config/rateLimiter.js'
import { paymentsWriteRateLimiter } from '../middleware/rateLimit.js'
import { createPaymentController } from '../controllers/payment.js'
import { paymentService } from '../services/payment.service.js'

const router = Router()

// Wire the controller with the shared paymentService singleton.
// To inject a test double, swap the service passed here.
const { processTip, createEscrow, getFee, updateFee } = createPaymentController(paymentService)

router.get('/fee', publicReadRateLimiter, getFee)
router.patch('/fee', authenticate, authorize('admin'), paymentsWriteRateLimiter, updateFee)
router.post('/tip', authenticate, paymentsWriteRateLimiter, processTip)
router.post('/escrow', authenticate, paymentsWriteRateLimiter, createEscrow)

export default router
