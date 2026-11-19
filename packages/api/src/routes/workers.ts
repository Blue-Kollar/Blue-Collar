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
} from '@/controllers/workers.js'
import { toggleBookmark } from '@/controllers/bookmarks.js'
import { createWorkerReview, deleteReview, listWorkerReviews } from '@/controllers/reviews.js'
import { getAvailability, upsertAvailability, addAvailabilitySlot, deleteAvailabilitySlot } from '@/controllers/availability.js'
import { registerOnChain } from '@/controllers/stellar.js'
import { createContactRequest, getContactRequests, updateContactRequestStatus } from '@/controllers/contact-request.js'
import { getWorkerVerifications } from '@/controllers/verifications.js'
import { getAnalytics, trackView, getViewTrends, getWorkerPersonalDashboard, exportWorkerPersonalCsv } from '@/controllers/analytics.js'
import { authenticate } from '@/middleware/auth.js'
import { validate } from '@/middleware/validate.js'
import { withAuth, withAuthAndValidation } from '@/middleware/composition.js'
import { upload, handleMulterError } from '@/middleware/upload.js'
import { createWorkerRules, listWorkersQuerySchema, searchWorkersQuerySchema, advancedSearchRules } from '@/validations/index.js'
import { cacheMiddleware, invalidateCachePattern, CacheTTL } from '@/middleware/cache.js'
import { contactRateLimit, generalRateLimit } from '@/middleware/rateLimit.js'
import { db } from '@/db.js'

import { idempotency } from '@/middleware/idempotency.js'

const router = Router()

async function showWorkerWithRatings(req: Request, res: Response) {
  const [worker, rating] = await Promise.all([
    db.worker.findUnique({
      where: { id: req.params.id },
      include: { category: true, portfolioItems: { orderBy: { order: 'asc' } } },
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

// NOTE (#1812): Duplicate registrations and routes with no callers were removed.
// Removed routes now fall through to notFoundHandler and return 404.

router.get('/', generalRateLimit, validate(listWorkersQuerySchema, 'query'), cacheMiddleware(CacheTTL.SHORT), listWorkers)
router.get('/search', generalRateLimit, validate(searchWorkersQuerySchema, 'query'), cacheMiddleware(CacheTTL.SHORT), searchWorkersHandler)
router.get('/search/advanced', generalRateLimit, validate(advancedSearchRules, 'query'), cacheMiddleware(CacheTTL.SHORT), advancedSearch)
router.get('/mine', withAuth('curator', 'admin'), listMyWorkers)
router.get('/:id', generalRateLimit, cacheMiddleware(CacheTTL.MEDIUM), showWorkerWithRatings)
router.post('/', withAuthAndValidation('curator', createWorkerRules), idempotency, createWorker)
router.put('/:id', withAuth('curator'), updateWorker)
router.delete('/:id', withAuth('curator'), deleteWorker)
router.patch('/:id/toggle', withAuth('curator'), toggleActivation)

// Availability
router.get('/:id/availability', cacheMiddleware(CacheTTL.SHORT), getAvailability)
router.put('/:id/availability', withAuth('curator'), upsertAvailability)
router.post('/:id/availability', withAuth('curator'), addAvailabilitySlot)
router.delete('/:id/availability/:slotId', withAuth('curator'), deleteAvailabilitySlot)

// On-chain registration
router.post('/:id/register-on-chain', withAuth('curator'), registerOnChain)

// Contact requests
router.post('/:id/contact', withAuth(), contactRateLimit, createContactRequest)
router.get('/:id/contacts', withAuth('curator'), getContactRequests)
router.patch('/:id/contacts/:requestId', withAuth('curator'), updateContactRequestStatus)

// Bookmarks
router.post('/:id/bookmark', withAuth(), toggleBookmark)

// Reviews
router.get('/:id/reviews', cacheMiddleware(CacheTTL.SHORT), listWorkerReviews)
router.post('/:id/reviews', withAuth(), createWorkerReview)
router.delete('/reviews/:id', authenticate, deleteReview)

// Verifications
router.get('/:id/verifications', withAuth('curator', 'admin'), getWorkerVerifications)

// Analytics
router.post('/:id/analytics/view', trackView)
router.get('/:id/analytics/dashboard', withAuth('curator', 'admin'), getWorkerPersonalDashboard)
router.get('/:id/analytics/export', withAuth('curator', 'admin'), exportWorkerPersonalCsv)
router.get('/:id/analytics', withAuth('curator', 'admin'), getAnalytics)
router.get('/:id/analytics/trends', withAuth('curator', 'admin'), getViewTrends)

// Reputation (#677)
router.get('/:id/reputation', cacheMiddleware(CacheTTL.SHORT), getReputation)
router.post('/:id/reputation/sync', withAuth('admin'), syncReputation)

export default router
