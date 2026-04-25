import { Router } from 'express'
import { createSubscription, listSubscriptions, deleteSubscription, getLogs } from '../controllers/webhooks.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)
router.post('/', createSubscription)
router.get('/', listSubscriptions)
router.delete('/:id', deleteSubscription)
router.get('/:id/logs', getLogs)

export default router
