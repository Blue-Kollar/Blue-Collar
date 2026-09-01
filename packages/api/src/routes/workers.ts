/**
 * Worker Routes
 * Execution Order: Rate Limit -> Auth -> Validation -> Cache -> Controller
 */
import { Router, type Request, type Response } from 'express'
import {
  listWorkers,
  listMyWorkers,
  createWorker,
  updateWorker,
  deleteWorker,
  toggleActivation,
  advancedSearch,
  searchWorkersHandler,
  getReputation,
  syncReputation,
} from '../controllers/workers.js'
import { toggleBookmark } from '../controllers/bookmarks.js'
import { createWorkerReview, deleteReview, listWorkerReviews } from '../controllers/reviews.js'
import { getAvailability, upsertAvailability, addAvailabilitySlot, deleteAvailabilitySlot } from '../controllers/availability.js'
import { registerOnChain } from '../controllers/stellar.js'
import { createContactRequest, getContactRequests, updateContactRequestStatus } from '../controllers/contact-request.js'
import { getWorkerVerifications } from '../controllers/verifications.js'
import { getAnalytics, trackView, getViewTrends, getWorkerPersonalDashboard, exportWorkerPersonalCsv } from '../controllers/analytics.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { withAuth, withAuthAndValidation } from '../middleware/composition.js'
import { upload, handleMulterError } from '../middleware/upload.js'
import { createWorkerRules } from '../validations/index.js'
import { cacheMiddleware, invalidateCachePattern, CacheTTL } from '../middleware/cache.js'
import { contactRateLimit, generalRateLimit } from '../middleware/userRateLimit.js'
import { db } from '../db.js'

import { idempotency } from '../middleware/idempotency.js'

const router = Router()

async function showWorkerWithRatings(req: Request, res: Response) {
  const [worker, rating] = await Promise.all([
    db.worker.findUnique({
      where: { id: req.params.id },
      include: { category: true, portfolio: { orderBy: { order: 'asc' } } },
    }),
    db.review.aggregate({
      where: { workerId: req.params.id },
      _avg: { rating: true },
      _count: { rating: true },
    }),
  ])
  if (!worker) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })
  return res.json({
    data: { ...worker, avgRating: rating._avg.rating ?? 0, reviewCount: rating._count.rating },
    status: 'success',
    code: 200,
  })
}

router.get('/', generalRateLimit, cacheMiddleware(CacheTTL.SHORT), listWorkers)
router.get('/search', generalRateLimit, cacheMiddleware(CacheTTL.SHORT), searchWorkersHandler)
router.get('/search/advanced', generalRateLimit, cacheMiddleware(CacheTTL.SHORT), advancedSearch)
router.get('/mine', authenticate, authorize('curator', 'admin'), listMyWorkers)
router.get('/mine', withAuth(['curator', 'admin']), listMyWorkers)
router.get('/:id', generalRateLimit, cacheMiddleware(CacheTTL.MEDIUM), showWorkerWithRatings)
router.post('/', authenticate, authorize('curator'), idempotency, validate(createWorkerRules), createWorker)
router.put('/:id', authenticate, authorize('curator'), updateWorker)
router.delete('/:id', authenticate, authorize('curator'), deleteWorker)
router.patch('/:id/toggle', authenticate, authorize('curator'), toggleActivation)
router.post('/', withAuthAndValidation('curator', createWorkerRules), createWorker)
router.put('/:id', withAuth('curator'), updateWorker)
router.delete('/:id', withAuth('curator'), deleteWorker)
router.patch('/:id/toggle', withAuth('curator'), toggleActivation)

// Availability
router.get('/:id/availability', cacheMiddleware(CacheTTL.SHORT), getAvailability)
router.put('/:id/availability', authenticate, authorize('curator'), upsertAvailability)
router.post('/:id/availability', authenticate, authorize('curator'), addAvailabilitySlot)
router.delete('/:id/availability/:slotId', authenticate, authorize('curator'), deleteAvailabilitySlot)
router.put('/:id/availability', withAuth('curator'), upsertAvailability)
router.post('/:id/availability', withAuth('curator'), addAvailabilitySlot)
router.delete('/:id/availability/:slotId', withAuth('curator'), deleteAvailabilitySlot)

// On-chain registration
router.post('/:id/register-on-chain', authenticate, authorize('curator'), registerOnChain)
router.post('/:id/register-on-chain', withAuth('curator'), registerOnChain)

// Contact requests
router.post('/:id/contact', authenticate, contactRateLimit, createContactRequest)
router.get('/:id/contacts', authenticate, authorize('curator'), getContactRequests)
router.patch('/:id/contacts/:requestId', authenticate, authorize('curator'), updateContactRequestStatus)
router.post('/:id/contact', withAuth(), contactRateLimit, createContactRequest)
router.get('/:id/contacts', withAuth('curator'), getContactRequests)
router.patch('/:id/contacts/:requestId', withAuth('curator'), updateContactRequestStatus)

// Bookmarks
router.post('/:id/bookmark', authenticate, toggleBookmark)
router.post('/:id/bookmark', withAuth(), toggleBookmark)

// Reviews
router.get('/:id/reviews', cacheMiddleware(CacheTTL.SHORT), listWorkerReviews)
router.post('/:id/reviews', authenticate, createWorkerReview)
router.post('/:id/reviews', withAuth(), createWorkerReview)
router.delete('/reviews/:id', authenticate, deleteReview)

// Verifications
router.get('/:id/verifications', authenticate, authorize('curator', 'admin'), getWorkerVerifications)
router.get('/:id/verifications', withAuth(['curator', 'admin']), getWorkerVerifications)

// Analytics
router.post('/:id/analytics/view', trackView)
router.get('/:id/analytics/dashboard', authenticate, authorize('curator', 'admin'), getWorkerPersonalDashboard)
router.get('/:id/analytics/export', authenticate, authorize('curator', 'admin'), exportWorkerPersonalCsv)
router.get('/:id/analytics', authenticate, authorize('curator', 'admin'), getAnalytics)
router.get('/:id/analytics/trends', authenticate, authorize('curator', 'admin'), getViewTrends)
router.get('/:id/analytics', withAuth(['curator', 'admin']), getAnalytics)

// Reputation (#677)
router.get('/:id/reputation', cacheMiddleware(CacheTTL.SHORT), getReputation)
router.post('/:id/reputation/sync', authenticate, authorize('admin'), syncReputation)
router.post('/:id/reputation/sync', withAuth('admin'), syncReputation)

export default router
