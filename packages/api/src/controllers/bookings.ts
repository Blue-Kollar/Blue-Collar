/**
 * Bookings controller — Issue #776
 *
 * Handles HTTP layer for booking requests and availability.
 */

import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import * as bookingService from '../services/booking.service.js'
import { AppError } from '../utils/AppError.js'

/**
 * POST /bookings
 * Create a booking request.
 */
export const createBooking = catchAsync(async (req: Request, res: Response) => {
  const requesterId = req.user!.id

  const booking = await bookingService.createBooking({
    workerId: req.body.workerId,
    requesterId,
    startTime: req.body.startTime,
    endTime: req.body.endTime,
    timezone: req.body.timezone ?? 'UTC',
    note: req.body.note,
    serviceDescription: req.body.serviceDescription,
  })

  res.status(201).json({ status: 'success', data: booking })
})

/**
 * PATCH /bookings/:id/confirm
 * Confirm a pending booking (worker only).
 */
export const confirmBooking = catchAsync(async (req: Request, res: Response) => {
  // Resolve workerId from authenticated user's worker profile
  const { db } = await import('../db.js')
  const worker = await db.worker.findUnique({ where: { userId: req.user!.id }, select: { id: true } })
  if (!worker) throw new AppError('Worker profile not found', 404)

  const booking = await bookingService.confirmBooking(req.params.id!, worker.id)
  res.json({ status: 'success', data: booking })
})

/**
 * PATCH /bookings/:id/cancel
 * Cancel a booking (either party).
 */
export const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const booking = await bookingService.cancelBooking(
    req.params.id!,
    req.user!.id,
    req.body.reason,
  )
  res.json({ status: 'success', data: booking })
})

/**
 * GET /bookings/mine
 * List bookings for the authenticated user (as worker or requester).
 */
export const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const { role, status, page, limit } = req.query as Record<string, string>
  const opts = {
    page: page ? parseInt(page) : 1,
    limit: limit ? parseInt(limit) : 20,
    status,
  }

  if (role === 'worker') {
    const { db } = await import('../db.js')
    const worker = await db.worker.findUnique({ where: { userId: req.user!.id }, select: { id: true } })
    if (!worker) throw new AppError('Worker profile not found', 404)
    const result = await bookingService.getWorkerBookings(worker.id, opts)
    return res.json({ status: 'success', ...result })
  }

  const result = await bookingService.getRequesterBookings(req.user!.id, opts)
  res.json({ status: 'success', ...result })
})
