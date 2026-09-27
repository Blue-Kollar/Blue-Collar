import { Router } from 'express'
import { createDispute, listDisputes, getDispute, resolveDispute } from '../controllers/disputes.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { disputesWriteRateLimiter } from '../middleware/rateLimit.js'

const router = Router()

router.post('/', authenticate, disputesWriteRateLimiter, createDispute)
router.get('/', authenticate, listDisputes)
router.get('/:id', authenticate, getDispute)
router.patch('/:id/resolve', authenticate, authorize('admin'), disputesWriteRateLimiter, resolveDispute)

export default router
