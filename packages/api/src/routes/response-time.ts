import { Router } from 'express'
import { respondToContact, getWorkerResponseStats, getResponseTimeAnalytics } from '../controllers/response-time.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

// Worker response stats (public)
router.get('/workers/:id/response-stats', getWorkerResponseStats)

// Respond to a contact request (curator/admin)
router.patch('/workers/:id/contacts/:requestId/respond', authenticate, authorize('curator', 'admin'), respondToContact)

// Analytics (admin only)
router.get('/analytics/response-times', authenticate, authorize('admin'), getResponseTimeAnalytics)

export default router
