import { Router } from 'express'
import { getRecommendations, trackInteraction } from '../controllers/recommendations.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/', authenticate, getRecommendations)
router.post('/interactions', authenticate, trackInteraction)

export default router
