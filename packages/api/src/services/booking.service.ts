/**
 * Booking service — Issue #776
 *
 * Handles booking request creation, conflict detection, timezone handling,
 * and notification dispatch on booking events.
 */

import { bookingRepository as defaultBookingRepository } from '../repositories/booking.repository.js'
import { AppError } from '../utils/AppError.js'
import { logger } from '../config/logger.js'
import { enqueueNotification } from '../queue/index.js'
import type { BookingServiceDeps } from '../container/types.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateBookingInput {
  workerId: string
  requesterId: string
  /** ISO 8601 datetime — stored in UTC */
  startTime: string
  /** ISO 8601 datetime — stored in UTC */
  endTime: string
  timezone: string
  note?: string
  serviceDescription: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert an ISO string to UTC Date, validating it is a real date. */
function parseUtc(iso: string, field: string): Date {
  const d = new Date(iso)
  if (isNaN(d.getTime())) throw new AppError(`${field} is not a valid ISO datetime`, 400)
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
      const now = new Date()

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
        return slotStartMinutes >= ah * 60 + am && slotEndMinutes <= bh * 60 + bm
      })

      if (availability.length > 0 && !coveredByAvailability) {
        throw new AppError('Requested time is outside the worker\'s availability', 409)
      }

      const existingBookings = await repo.findConflicting(workerId, startTime, endTime)

      if (hasConflict({ startTime, endTime }, existingBookings)) {
        throw new AppError('Worker is already booked during this time slot', 409)
      }

      const booking = await repo.createBooking({
        workerId,
        requesterId,
        startTime,
        endTime,
        timezone,
        note,
        serviceDescription,
        status: 'pending',
      } as any)

      logger.info({ bookingId: booking.id, workerId, requesterId }, 'Booking request created')

      await enqueueNotification({
        userId: (booking as any).worker.userId,
        type: 'booking_request',
        title: 'New booking request',
        message: `${(booking as any).requester.firstName ?? 'A user'} has requested a booking on ${startTime.toUTCString()}.`,
        channels: ['email', 'push', 'inapp'],
        href: `/bookings/${booking.id}`,
      })

      return booking
    },

    /**
     * Confirm a pending booking (worker only).
     */
    async confirmBooking(bookingId: string, workerId: string) {
      const booking = await repo.findBookingWithWorker(bookingId)
      if (!booking) throw new AppError('Booking not found', 404)
      if ((booking as any).workerId !== workerId) throw new AppError('Unauthorized', 403)
      if ((booking as any).status !== 'pending') throw new AppError(`Cannot confirm a booking with status: ${(booking as any).status}`, 400)

      const updated = await repo.updateBooking(bookingId, { status: 'confirmed' } as any)

      await enqueueNotification({
        userId: (booking as any).requesterId,
        type: 'booking_confirmed',
        title: 'Booking confirmed!',
        message: `Your booking on ${(booking as any).startTime.toUTCString()} has been confirmed.`,
        channels: ['email', 'push', 'inapp'],
        href: `/bookings/${bookingId}`,
      })

      return updated
    },

    /**
     * Cancel a booking (either party can cancel; workers can cancel confirmed bookings).
     */
    async cancelBooking(bookingId: string, userId: string, reason?: string) {
      const booking = await repo.findBookingWithCancelInfo(bookingId)
      if (!booking) throw new AppError('Booking not found', 404)

      const isRequester = (booking as any).requesterId === userId
      const isWorker = (booking as any).worker.userId === userId
      if (!isRequester && !isWorker) throw new AppError('Unauthorized', 403)

      if (['completed', 'cancelled'].includes((booking as any).status)) {
        throw new AppError(`Cannot cancel a booking with status: ${(booking as any).status}`, 400)
      }

      const updated = await repo.updateBooking(bookingId, { status: 'cancelled', cancellationReason: reason } as any)

      const notifyUserId = isWorker ? (booking as any).requesterId : (booking as any).worker.userId
      await enqueueNotification({
        userId: notifyUserId,
        type: 'booking_cancelled',
        title: 'Booking cancelled',
        message: `A booking on ${(booking as any).startTime.toUTCString()} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
        channels: ['email', 'inapp'],
      })

      return updated
    },

    /**
     * List all bookings for a worker (paginated).
     */
    async getWorkerBookings(
      workerId: string,
      options: { page?: number; limit?: number; status?: string } = {},
    ) {
      const { page = 1, limit = 20, status } = options
      return repo.findWorkerBookings(workerId, { page, limit, status })
    },

    /**
     * List all bookings made by a requester.
     */
    async getRequesterBookings(
      requesterId: string,
      options: { page?: number; limit?: number; status?: string } = {},
    ) {
      const { page = 1, limit = 20, status } = options
      return repo.findRequesterBookings(requesterId, { page, limit, status })
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createBookingService({
  bookingRepository: defaultBookingRepository,
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
  options: { page?: number; limit?: number; status?: string } = {},
) {
  return _defaultService.getWorkerBookings(workerId, options)
}

export async function getRequesterBookings(
  requesterId: string,
  options: { page?: number; limit?: number; status?: string } = {},
) {
  return _defaultService.getRequesterBookings(requesterId, options)
}
