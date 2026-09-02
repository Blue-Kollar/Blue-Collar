import { Router } from 'express'

import { listRequests, requestVerification, reviewRequest } from '../controllers/verifications.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.post('/', authenticate, requestVerification)
router.get('/', authenticate, authorize('admin'), listRequests)
router.patch('/:id/review', authenticate, authorize('admin'), reviewRequest)

export default router
