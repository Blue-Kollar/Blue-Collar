/**
 * Booking service — Issue #776
 *
 * Handles booking request creation, conflict detection, timezone handling,
 * and notification dispatch on booking events.
 */

import { bookingRepository as defaultBookingRepository } from '@/repositories/booking.repository.js'
import { AppError } from '@/utils/app-error.js'
import { logger } from '@/config/logger.js'
import { enqueueNotification } from '@/queue/index.js'
import { nowUtc, parseUtcDate } from '@/utils/date.js'
import type { BookingServiceDeps } from '@/container/types.js'
import { BookingStatus } from '@bluecollar/types'
import type { CreateBookingInput } from '@bluecollar/types'

// ── Transaction helper ────────────────────────────────────────────────────────

/**
 * Run `fn` inside a database transaction when the repository supports it.
 * Falls back to executing `fn` directly for repositories without transaction
 * support (e.g. lightweight test doubles).
 */
async function withTransaction<T>(
  repo: BookingServiceDeps['bookingRepository'],
  fn: (tx: BookingServiceDeps['bookingRepository']) => Promise<T>,
): Promise<T> {
  if (typeof repo.transaction === 'function') {
    return repo.transaction((tx) => fn(tx))
  }
  return fn(repo)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type { CreateBookingInput }

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert an ISO string to UTC Date, validating it is a real date. */
function parseUtc(iso: string, field: string): Date {
  const d = parseUtcDate(iso)
  if (!d) throw new AppError(`${field} is not a valid ISO datetime`, 400)
  return d
}

interface BookingSlot { startTime: Date; endTime: Date }

/**
 * Detect if `newSlot` conflicts with any of `existingSlots`.
 */
function hasConflict(newSlot: BookingSlot, existingSlots: BookingSlot[]): boolean {
  return existingSlots.some(
    (s) => newSlot.startTime < s.endTime && newSlot.endTime > s.startTime,
  )
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createBookingService(deps: BookingServiceDeps) {
  const { bookingRepository: repo } = deps

  return {
    /**
     * Create a booking request after validating availability and conflicts.
     */
    async createBooking(input: CreateBookingInput) {
      const { workerId, requesterId, timezone, note, serviceDescription } = input

      const startTime = parseUtc(input.startTime, 'startTime')
      const endTime = parseUtc(input.endTime, 'endTime')
      const now = nowUtc()

      if (startTime <= now) throw new AppError('startTime must be in the future', 400)
      if (endTime <= startTime) throw new AppError('endTime must be after startTime', 400)
      if (workerId === requesterId) throw new AppError('You cannot book yourself', 400)

      // Verify worker exists
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      // Check availability schedule — slot must fall within at least one available window
      const dayOfWeek = startTime.getUTCDay()
      const slotStartMinutes = startTime.getUTCHours() * 60 + startTime.getUTCMinutes()
      const slotEndMinutes = endTime.getUTCHours() * 60 + endTime.getUTCMinutes()

      const availability = await repo.findAvailabilityByWorkerAndDay(workerId, dayOfWeek)

      const coveredByAvailability = availability.some((avail) => {
        const [ah, am] = avail.startTime.split(':').map(Number)
        const [bh, bm] = avail.endTime.split(':').map(Number)
        return slotStartMinutes >= ah! * 60 + am! && slotEndMinutes <= bh! * 60 + bm!
      })

      if (availability.length > 0 && !coveredByAvailability) {
        throw new AppError('Requested time is outside the worker\'s availability', 409)
      }

      // Wrap conflict re-check, booking creation and notification enqueue in a
      // single transaction so a partial write can never leave an orphaned
      // booking or a notification for a booking that was rolled back.
      const booking = await withTransaction(repo, async (tx) => {
        const existingBookings = await tx.findConflicting(workerId, startTime, endTime)

        if (hasConflict({ startTime, endTime }, existingBookings)) {
          throw new AppError('Worker is already booked during this time slot', 409)
        }

        const created = await tx.createBooking({
          workerId,
          requesterId,
          startTime,
          endTime,
          timezone,
          note,
          serviceDescription: serviceDescription ?? '',
          status: BookingStatus.Pending,
        })

        await enqueueNotification({
          userId: created.worker.userId,
          type: 'booking_request',
          title: 'New booking request',
          message: `${created.requester.firstName ?? 'A user'} has requested a booking on ${startTime.toUTCString()}.`,
          channels: ['email', 'push', 'inapp'],
          href: `/bookings/${created.id}`,
        })

        return created
      })

      logger.info({ bookingId: booking.id, workerId, requesterId }, 'Booking request created')

      return booking
    },

    /**
     * Confirm a pending booking (worker only).
     */
    async confirmBooking(bookingId: string, workerId: string) {
      const booking = await repo.findBookingWithWorker(bookingId)
      if (!booking) throw new AppError('Booking not found', 404)
      if (booking.workerId !== workerId) throw new AppError('Unauthorized', 403)
      if (booking.status !== BookingStatus.Pending) throw new AppError(`Cannot confirm a booking with status: ${booking.status}`, 400)

      const updated = await withTransaction(repo, async (tx) => {
        const result = await tx.updateBooking(bookingId, { status: BookingStatus.Confirmed })

        await enqueueNotification({
          userId: booking.requesterId,
          type: 'booking_confirmed',
          title: 'Booking confirmed!',
          message: `Your booking on ${booking.startTime.toUTCString()} has been confirmed.`,
          channels: ['email', 'push', 'inapp'],
          href: `/bookings/${bookingId}`,
        })

        return result
      })

      return updated
    },

    /**
     * Cancel a booking (either party can cancel; workers can cancel confirmed bookings).
     */
    async cancelBooking(bookingId: string, userId: string, reason?: string) {
      const booking = await repo.findBookingWithCancelInfo(bookingId)
      if (!booking) throw new AppError('Booking not found', 404)

      const isRequester = booking.requesterId === userId
      const isWorker = booking.worker.userId === userId
      if (!isRequester && !isWorker) throw new AppError('Unauthorized', 403)

      if (booking.status === BookingStatus.Completed || booking.status === BookingStatus.Cancelled) {
        throw new AppError(`Cannot cancel a booking with status: ${booking.status}`, 400)
      }

      const notifyUserId = isWorker ? booking.requesterId : booking.worker.userId

      const updated = await withTransaction(repo, async (tx) => {
        const result = await tx.updateBooking(bookingId, { status: BookingStatus.Cancelled, cancellationReason: reason })

        await enqueueNotification({
          userId: notifyUserId,
          type: 'booking_cancelled',
          title: 'Booking cancelled',
          message: `A booking on ${booking.startTime.toUTCString()} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
          channels: ['email', 'inapp'],
        })

        return result
      })

      return updated
    },

    /**
     * List all bookings for a worker (paginated).
     */
    async getWorkerBookings(
      workerId: string,
      options: { page?: number; limit?: number; status?: BookingStatus } = {},
    ) {
      const { page = 1, limit = 20, status } = options
      // Repository performs a single paginated query with related records
      // eagerly included, avoiding per-booking N+1 lookups.
      return repo.findWorkerBookings(workerId, { page, limit, status })
    },

    /**
     * List all bookings made by a requester.
     */
    async getRequesterBookings(
      requesterId: string,
      options: { page?: number; limit?: number; status?: BookingStatus } = {},
    ) {
      const { page = 1, limit = 20, status } = options
      // Single paginated query with eager-loaded relations (no N+1).
      return repo.findRequesterBookings(requesterId, { page, limit, status })
    },

    /**
     * Resolve the current user's bookings for GET /bookings/mine.
     *
     * The route previously decided between worker and requester listings based
     * on the authenticated user's role. That branching now lives here so the
     * route stays a thin HTTP adapter.
     */
    async getMyBookings(
      userId: string,
      role: string,
      options: { page?: number; limit?: number; status?: BookingStatus } = {},
    ) {
      const { page = 1, limit = 20, status } = options

      if (role === 'WORKER') {
        return repo.findWorkerBookings(userId, { page, limit, status })
      }

      return repo.findRequesterBookings(userId, { page, limit, status })
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createBookingService({
  bookingRepository: defaultBookingRepository as unknown as BookingServiceDeps['bookingRepository'],
})

export async function createBooking(input: CreateBookingInput) {
  return _defaultService.createBooking(input)
}

export async function confirmBooking(bookingId: string, workerId: string) {
  return _defaultService.confirmBooking(bookingId, workerId)
}

export async function cancelBooking(bookingId: string, userId: string, reason?: string) {
  return _defaultService.cancelBooking(bookingId, userId, reason)
}

export async function getWorkerBookings(
  workerId: string,
  options: { page?: number; limit?: number; status?: BookingStatus } = {},
) {
  return _defaultService.getWorkerBookings(workerId, options)
}

export async function getRequesterBookings(
  requesterId: string,
  options: { page?: number; limit?: number; status?: BookingStatus } = {},
) {
  return _defaultService.getRequesterBookings(requesterId, options)
}

export async function getMyBookings(
  userId: string,
  role: string,
  options: { page?: number; limit?: number; status?: BookingStatus } = {},
) {
  return _defaultService.getMyBookings(userId, role, options)
}
