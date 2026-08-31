/**
 * booking.service.test.ts — unit tests for BookingService (#1259)
 *
 * Coverage for:
 *  - createBooking: invalid dates, start ≥ end, worker-requester same person,
 *    worker not found, conflict detection, happy path
 *  - confirmBooking: not found, unauthorized (not the worker), wrong status, happy path
 *  - cancelBooking: not found, unauthorized, already completed/cancelled, happy path
 *  - getWorkerBookings / getRequesterBookings: delegation to repo
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../queue/index.js', () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { createBookingService, type CreateBookingInput } from './booking.service.js'
import { AppError } from '../utils/AppError.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const WORKER_ID = 'worker-1'
const WORKER_USER_ID = 'wuser-1'
const REQUESTER_ID = 'req-user-1'
const BOOKING_ID = 'booking-1'

// Dates well in the future to avoid "startTime must be in the future" errors
const START = '2099-07-01T09:00:00.000Z'
const END = '2099-07-01T11:00:00.000Z'

function makeBaseBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: BOOKING_ID,
    workerId: WORKER_ID,
    requesterId: REQUESTER_ID,
    startTime: new Date(START),
    endTime: new Date(END),
    timezone: 'UTC',
    status: 'pending',
    serviceDescription: 'Fix the sink',
    worker: { id: WORKER_ID, userId: WORKER_USER_ID },
    requester: { id: REQUESTER_ID, firstName: 'Alice' },
    ...overrides,
  }
}

function makeRepo(overrides: Record<string, unknown> = {}) {
  return {
    createBooking: vi.fn().mockResolvedValue(makeBaseBooking()),
    findBookingWithWorker: vi.fn().mockResolvedValue(null),
    findBookingWithCancelInfo: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    findConflicting: vi.fn().mockResolvedValue([]),
    findAvailabilityByWorkerAndDay: vi.fn().mockResolvedValue([]), // no constraints
    findWorkerById: vi.fn().mockResolvedValue({ id: WORKER_ID }),
    findWorkerBookings: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    findRequesterBookings: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    updateBooking: vi.fn().mockImplementation((_id: string, patch: Record<string, unknown>) =>
      Promise.resolve(makeBaseBooking(patch))
    ),
    ...overrides,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// createBooking
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService.createBooking', () => {
  it('throws when startTime is an invalid ISO string', async () => {
    const repo = makeRepo()
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(
      svc.createBooking({
        workerId: WORKER_ID,
        requesterId: REQUESTER_ID,
        startTime: 'not-a-date',
        endTime: END,
        timezone: 'UTC',
        serviceDescription: 'Fix the sink',
      }),
    ).rejects.toThrow(AppError)
  })

  it('throws when endTime is not after startTime', async () => {
    const repo = makeRepo()
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(
      svc.createBooking({
        workerId: WORKER_ID,
        requesterId: REQUESTER_ID,
        startTime: END,
        endTime: START,
        timezone: 'UTC',
        serviceDescription: 'Fix the sink',
      }),
    ).rejects.toThrow(AppError)
  })

  it('throws when workerId equals requesterId', async () => {
    const repo = makeRepo()
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(
      svc.createBooking({
        workerId: REQUESTER_ID,
        requesterId: REQUESTER_ID,
        startTime: START,
        endTime: END,
        timezone: 'UTC',
        serviceDescription: 'Fix the sink',
      }),
    ).rejects.toThrow(AppError)
  })

  it('throws 404 when worker is not found', async () => {
    const repo = makeRepo({ findWorkerById: vi.fn().mockResolvedValue(null) })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(
      svc.createBooking({
        workerId: 'unknown-worker',
        requesterId: REQUESTER_ID,
        startTime: START,
        endTime: END,
        timezone: 'UTC',
        serviceDescription: 'Fix the sink',
      }),
    ).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 409 when a conflicting booking exists', async () => {
    const repo = makeRepo({ findConflicting: vi.fn().mockResolvedValue([makeBaseBooking()]) })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(
      svc.createBooking({
        workerId: WORKER_ID,
        requesterId: REQUESTER_ID,
        startTime: START,
        endTime: END,
        timezone: 'UTC',
        serviceDescription: 'Fix the sink',
      }),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('creates booking successfully with no conflicts', async () => {
    const repo = makeRepo()
    const svc = createBookingService({ bookingRepository: repo as any })

    const result = await svc.createBooking({
      workerId: WORKER_ID,
      requesterId: REQUESTER_ID,
      startTime: START,
      endTime: END,
      timezone: 'America/New_York',
      serviceDescription: 'Fix the sink',
      note: 'Bring pipe wrench',
    })

    expect(repo.createBooking).toHaveBeenCalledWith(
      expect.objectContaining({ workerId: WORKER_ID, requesterId: REQUESTER_ID, status: 'pending' }),
    )
    expect(result.id).toBe(BOOKING_ID)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// confirmBooking
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService.confirmBooking', () => {
  it('throws 404 when booking does not exist', async () => {
    const repo = makeRepo({ findBookingWithWorker: vi.fn().mockResolvedValue(null) })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(svc.confirmBooking(BOOKING_ID, WORKER_USER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when caller is not the booking worker', async () => {
    const repo = makeRepo({ findBookingWithWorker: vi.fn().mockResolvedValue(makeBaseBooking()) })
    const svc = createBookingService({ bookingRepository: repo as any })

    // workerId in the booking is WORKER_ID, not 'stranger-worker'
    await expect(svc.confirmBooking(BOOKING_ID, 'stranger-worker')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws 400 when booking is not in pending status', async () => {
    const repo = makeRepo({
      findBookingWithWorker: vi.fn().mockResolvedValue(makeBaseBooking({ status: 'confirmed' })),
    })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(svc.confirmBooking(BOOKING_ID, WORKER_ID)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('updates booking to confirmed on happy path', async () => {
    const repo = makeRepo({
      findBookingWithWorker: vi.fn().mockResolvedValue(makeBaseBooking()),
      updateBooking: vi.fn().mockResolvedValue(makeBaseBooking({ status: 'confirmed' })),
    })
    const svc = createBookingService({ bookingRepository: repo as any })

    const result = await svc.confirmBooking(BOOKING_ID, WORKER_ID)

    expect(repo.updateBooking).toHaveBeenCalledWith(BOOKING_ID, expect.objectContaining({ status: 'confirmed' }))
    expect(result.status).toBe('confirmed')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// cancelBooking
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService.cancelBooking', () => {
  it('throws 404 when booking does not exist', async () => {
    const repo = makeRepo({ findBookingWithCancelInfo: vi.fn().mockResolvedValue(null) })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(svc.cancelBooking(BOOKING_ID, REQUESTER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 403 when caller is neither requester nor worker', async () => {
    const repo = makeRepo({ findBookingWithCancelInfo: vi.fn().mockResolvedValue(makeBaseBooking()) })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(svc.cancelBooking(BOOKING_ID, 'stranger')).rejects.toMatchObject({ statusCode: 403 })
  })

  it('throws 400 when booking is already completed', async () => {
    const repo = makeRepo({
      findBookingWithCancelInfo: vi.fn().mockResolvedValue(makeBaseBooking({ status: 'completed' })),
    })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(svc.cancelBooking(BOOKING_ID, REQUESTER_ID)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 when booking is already cancelled', async () => {
    const repo = makeRepo({
      findBookingWithCancelInfo: vi.fn().mockResolvedValue(makeBaseBooking({ status: 'cancelled' })),
    })
    const svc = createBookingService({ bookingRepository: repo as any })

    await expect(svc.cancelBooking(BOOKING_ID, REQUESTER_ID)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('cancels booking when called by requester', async () => {
    const repo = makeRepo({
      findBookingWithCancelInfo: vi.fn().mockResolvedValue(makeBaseBooking()),
      updateBooking: vi.fn().mockResolvedValue(makeBaseBooking({ status: 'cancelled' })),
    })
    const svc = createBookingService({ bookingRepository: repo as any })

    const result = await svc.cancelBooking(BOOKING_ID, REQUESTER_ID, 'Change of plans')

    expect(repo.updateBooking).toHaveBeenCalledWith(
      BOOKING_ID,
      expect.objectContaining({ status: 'cancelled' }),
    )
    expect(result.status).toBe('cancelled')
  })

  it('cancels booking when called by worker', async () => {
    const repo = makeRepo({
      findBookingWithCancelInfo: vi.fn().mockResolvedValue(makeBaseBooking()),
      updateBooking: vi.fn().mockResolvedValue(makeBaseBooking({ status: 'cancelled' })),
    })
    const svc = createBookingService({ bookingRepository: repo as any })

    const result = await svc.cancelBooking(BOOKING_ID, WORKER_USER_ID)

    expect(result.status).toBe('cancelled')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getWorkerBookings / getRequesterBookings
// ─────────────────────────────────────────────────────────────────────────────

describe('BookingService.getWorkerBookings', () => {
  it('delegates to repo with defaults', async () => {
    const repo = makeRepo()
    const svc = createBookingService({ bookingRepository: repo as any })

    await svc.getWorkerBookings(WORKER_ID)

    expect(repo.findWorkerBookings).toHaveBeenCalledWith(WORKER_ID, expect.objectContaining({ page: 1, limit: 20 }))
  })

  it('passes custom page and limit', async () => {
    const repo = makeRepo()
    const svc = createBookingService({ bookingRepository: repo as any })

    await svc.getWorkerBookings(WORKER_ID, { page: 3, limit: 5 })

    expect(repo.findWorkerBookings).toHaveBeenCalledWith(WORKER_ID, expect.objectContaining({ page: 3, limit: 5 }))
  })
})

describe('BookingService.getRequesterBookings', () => {
  it('delegates to repo', async () => {
    const repo = makeRepo()
    const svc = createBookingService({ bookingRepository: repo as any })

    await svc.getRequesterBookings(REQUESTER_ID, { status: 'confirmed' })

    expect(repo.findRequesterBookings).toHaveBeenCalledWith(
      REQUESTER_ID,
      expect.objectContaining({ status: 'confirmed' }),
    )
  })
})
