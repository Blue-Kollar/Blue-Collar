import { Router } from 'express'

import { createDispute, getDispute, listDisputes, resolveDispute } from '../controllers/disputes.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.post('/', authenticate, createDispute)
router.get('/', authenticate, listDisputes)
router.get('/:id', authenticate, getDispute)
router.patch('/:id/resolve', authenticate, authorize('admin'), resolveDispute)

export default router
