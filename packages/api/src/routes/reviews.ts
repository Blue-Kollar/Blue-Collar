import { Router } from 'express'
import {
  listReviews,
  createReview,
  flagReview,
  getModerationQueue,
  moderateReview,
} from '../controllers/reviews.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router({ mergeParams: true })

router.get('/', listReviews)
router.post('/', authenticate, createReview)
router.patch('/:id/flag', authenticate, flagReview)

// Admin moderation
router.get('/moderation/queue', authenticate, authorize('admin'), getModerationQueue)
router.patch('/:id/moderate', authenticate, authorize('admin'), moderateReview)

export default router
