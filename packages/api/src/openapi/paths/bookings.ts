import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

// app.ts mounts routes/bookings.ts at unversioned /api/bookings only. The
// app.use('/api/v1/bookings', bookingRoutes) call references an undefined
// `bookingRoutes` identifier (app.ts never imports it — only `bookingsRoutes`,
// the router this file actually documents, is imported), so there is no
// working /api/v1/bookings mount to document.

const BookingSchema = registry.register('Booking', z.object({
  id: z.string(),
  workerId: z.string(),
  requesterId: z.string(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  startTime: z.string(),
  endTime: z.string(),
  timezone: z.string(),
  note: z.string().nullable(),
  serviceDescription: z.string().nullable(),
}))

registry.registerPath({
  method: 'post', path: '/api/bookings', tags: ['Bookings'],
  summary: 'Create a booking request (rate-limited to 10/hr per user)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            workerId: z.string(),
            startTime: z.string(),
            endTime: z.string(),
            timezone: z.string().optional(),
            note: z.string().optional(),
            serviceDescription: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: { description: 'Booking created', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: BookingSchema }) } } },
    429: { description: 'Rate limit exceeded' },
  },
})

registry.registerPath({
  method: 'get', path: '/api/bookings/mine', tags: ['Bookings'],
  summary: 'List bookings for the authenticated user',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    query: z.object({
      role: z.enum(['worker', 'requester']).optional(),
      status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']).optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: { 200: { description: 'Bookings', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(BookingSchema) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/bookings/{id}/confirm', tags: ['Bookings'],
  summary: 'Confirm a pending booking (worker only)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Booking confirmed', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: BookingSchema }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/bookings/{id}/cancel', tags: ['Bookings'],
  summary: 'Cancel a booking (worker or requester)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ reason: z.string().optional() }) } } } },
  responses: { 200: { description: 'Booking cancelled', content: { 'application/json': { schema: SuccessSchema } } } },
})
