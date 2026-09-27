import { Router } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { publicReadRateLimiter } from '../config/rateLimiter.js'
import {
  listReviews,
  createReview,
  flagReview,
  getModerationQueue,
  moderateReview,
  deleteReview,
} from '../controllers/reviews.js'

const router = Router({ mergeParams: true })

router.get('/', publicReadRateLimiter, listReviews)
router.post('/', authenticate, createReview)
router.delete('/:id', authenticate, deleteReview)

/** PATCH /api/workers/:workerId/reviews/:id/flag — flag a review for moderation. */
router.patch('/:id/flag', authenticate, flagReview)

// Admin moderation
router.get('/moderation/queue', authenticate, authorize('admin'), getModerationQueue)
router.patch('/:id/moderate', authenticate, authorize('admin'), moderateReview)

export default router
