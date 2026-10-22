import { z } from 'zod'
import { sanitizedString } from './worker.js'

// NOTE: Booking endpoints currently accept no free-text fields.
// The only string input is `workerId`, which is an opaque identifier and is
// validated below. If a free-text field (e.g. `notes` / `description`) is
// added in the future, it MUST use `sanitisedString` from './common' so that
// script-tag payloads are stripped before storage/display.
export const createBookingRules = z.object({
  workerId: z.string().min(1, 'workerId is required'),
  startTime: z.string().datetime({ message: 'startTime must be an ISO-8601 datetime' }),
  endTime: z.string().datetime({ message: 'endTime must be an ISO-8601 datetime' }),
})

export const listMyBookingsQuery = z.object({
  role: z.enum(['worker', 'requester']).optional(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
})

// Reserved for future free-text booking fields; exported so write paths can
// reuse the shared sanitised string validation.
export const bookingFreeTextRules = z.object({
  notes: sanitizedString(1000).optional(),
  description: sanitizedString(1000).optional(),
})