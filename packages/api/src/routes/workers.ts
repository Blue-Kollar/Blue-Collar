import { Router } from 'express'
import {
  listWorkers,
  listMyWorkers,
  createWorker,
  showWorker,
  updateWorker,
  deleteWorker,
  toggleActivation,
} from '../controllers/workers.js'
import { toggleBookmark } from '../controllers/bookmarks.js'
import { createReview, listReviews } from '../controllers/reviews.js'
import { getAvailability, upsertAvailability, addAvailabilitySlot, deleteAvailabilitySlot } from '../controllers/availability.js'
import { registerOnChain } from '../controllers/stellar.js'
import { createContactRequest, getContactRequests, updateContactRequestStatus } from '../controllers/contact-request.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { upload, handleMulterError } from '../middleware/upload.js'
import { createWorkerRules } from '../validations/worker.js'
import { cacheMiddleware, invalidateCachePattern, TTL } from '../middleware/cache.js'
import { contactRateLimit, generalRateLimit } from '../middleware/userRateLimit.js'

const router = Router()

router.get('/', generalRateLimit, cacheMiddleware(TTL.MEDIUM), listWorkers)
router.get('/mine', authenticate, authorize('curator', 'admin'), listMyWorkers)
router.get('/:id', generalRateLimit, cacheMiddleware(TTL.MEDIUM), showWorker)
router.post('/', authenticate, authorize('curator'), validate(createWorkerRules), createWorker)
router.put('/:id', authenticate, authorize('curator'), updateWorker)
router.delete('/:id', authenticate, authorize('curator'), deleteWorker)
router.patch('/:id/toggle', authenticate, authorize('curator'), toggleActivation)

// Availability
router.get('/:id/availability', cacheMiddleware(TTL.SHORT), getAvailability)
router.put('/:id/availability', authenticate, authorize('curator'), upsertAvailability)
router.post('/:id/availability', authenticate, authorize('curator'), addAvailabilitySlot)
router.delete('/:id/availability/:slotId', authenticate, authorize('curator'), deleteAvailabilitySlot)

// On-chain registration
router.post('/:id/register-on-chain', authenticate, authorize('curator'), registerOnChain)

// Contact requests
router.post('/:id/contact', authenticate, contactRateLimit, createContactRequest)
router.get('/:id/contacts', authenticate, authorize('curator'), getContactRequests)
router.patch('/:id/contacts/:requestId', authenticate, authorize('curator'), updateContactRequestStatus)

// Bookmarks
router.post('/:id/bookmark', authenticate, toggleBookmark)

// Reviews
router.get('/:id/reviews', cacheMiddleware(TTL.SHORT), listReviews)
router.post('/:id/reviews', authenticate, createReview)

export default router
