import { Router } from 'express';
import { authenticate, authorize } from '@/middleware/auth.js';
import { publicReadRateLimiter } from '@/config/rate-limiter.js';
import { paymentsWriteRateLimiter } from '@/middleware/rate-limit.js';
import { createPaymentController } from '@/controllers/payment.js';
import { paymentService } from '@/services/payment.service.js';
import { idempotency } from '@/middleware/idempotency.js';

const router = Router();

// Wire the controller with the shared paymentService singleton.
// To inject a test double, swap the service passed here.
const { processTip, createEscrow, getFee, updateFee } = createPaymentController(paymentService);

router.get('/fee', publicReadRateLimiter, getFee);
router.patch('/fee', authenticate, authorize('admin'), paymentsWriteRateLimiter, updateFee);
// Payment-initiating writes replay the stored response for a repeated Idempotency-Key (#1821).
router.post('/tip', authenticate, paymentsWriteRateLimiter, idempotency, processTip);
router.post('/escrow', authenticate, paymentsWriteRateLimiter, idempotency, createEscrow);

export default router;
