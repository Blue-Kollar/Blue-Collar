/**
 * Booking routes — Issue #776
 */
import { Router } from 'express'
import { authenticateJWT } from '../middleware/auth.js'
import { bookingRateLimit } from '../middleware/rateLimit.js'
import {
  createBooking,
  confirmBooking,
  cancelBooking,
  getMyBookings,
} from '../controllers/bookings.js'

const router = Router()

// All booking routes require authentication
router.use(authenticateJWT)

/**
 * POST /bookings
 * Create a booking request. Rate-limited to 10/hr per user.
 */
router.post('/', bookingRateLimit, createBooking)

/**
 * GET /bookings/mine
 * List bookings for the authenticated user.
 * ?role=worker|requester&status=pending|confirmed|cancelled|completed
 */
router.get('/mine', getMyBookings)

/**
 * PATCH /bookings/:id/confirm
 * Confirm a pending booking (worker only).
 */
router.patch('/:id/confirm', confirmBooking)

/**
 * PATCH /bookings/:id/cancel
 * Cancel a booking (worker or requester).
 */
router.patch('/:id/cancel', cancelBooking)

export default router
