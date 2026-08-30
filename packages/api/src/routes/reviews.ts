import { Router, type Request, type Response } from 'express'
import { authenticate, authorize } from '../middleware/auth.js'
import { publicReadRateLimiter } from '../config/rateLimiter.js'
import {
  listReviews,
  createReview,
  flagReview,
  getModerationQueue,
  moderateReview,
} from '../controllers/reviews.js'
import { createReview as createReviewForWorker } from '../services/review.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { db } from '../db.js'

const router = Router({ mergeParams: true })

export async function listWorkerReviews(req: Request, res: Response) {
  const workerId = req.params.workerId ?? req.params.id
  const [reviews, aggregate] = await Promise.all([
    db.review.findMany({
      where: { workerId },
      include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    db.review.aggregate({
      where: { workerId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ])

  return res.json({
    data: reviews,
    avgRating: aggregate._avg.rating ?? 0,
    reviewCount: aggregate._count.rating,
    status: 'success',
    code: 200,
  })
}

export const createWorkerReview = catchAsync(async (req: Request, res: Response) => {
  const workerId = req.params.id ?? req.params.workerId
  const { rating, comment, transactionHash } = req.body
  const review = await createReviewForWorker(workerId, req.user!.id, rating, comment, transactionHash)
  return res.status(201).json({
    data: review,
    status: 'success',
    message: 'Review created (pending moderation)',
    code: 201,
  })
})

export async function deleteReview(req: Request, res: Response) {
  const id = req.params.id
  if (!id) return res.status(400).json({ status: 'error', message: 'Missing review id', code: 400 })

  const review = await db.review.findUnique({ where: { id } })
  if (!review) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })
  if (review.authorId !== req.user!.id) {
    return res.status(403).json({ status: 'error', message: 'Forbidden', code: 403 })
  }

  await db.review.delete({ where: { id } })
  return res.status(204).send()
}

router.get('/', publicReadRateLimiter, listReviews)
router.post('/', authenticate, createReview)
router.delete('/:id', authenticate, deleteReview)

/** PATCH /api/workers/:workerId/reviews/:id/flag — flag a review for moderation. */
router.patch('/:id/flag', authenticate, flagReview)

// Admin moderation
router.get('/moderation/queue', authenticate, authorize('admin'), getModerationQueue)
router.patch('/:id/moderate', authenticate, authorize('admin'), moderateReview)

export default router
