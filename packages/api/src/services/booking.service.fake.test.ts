/**
 * booking.service.fake.test.ts — Issue #1354
 *
 * Fast unit-test conversion: exercises createBookingService via the
 * in-memory FakeBookingRepository instead of vi.mock()-ing individual repo
 * methods (see booking.service.test.ts), so tests read as plain
 * arrange/act/assert without any mock-return wiring.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../queue/index.js', () => ({ enqueueNotification: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../config/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { createBookingService } from './booking.service.js'
import { FakeBookingRepository } from '../__tests__/helpers/fakeRepositories.js'
import { AppError } from '../utils/AppError.js'

const WORKER_ID = 'worker-1'
const WORKER_USER_ID = 'wuser-1'
const REQUESTER_ID = 'req-user-1'
const START = '2099-07-01T09:00:00.000Z'
const END = '2099-07-01T11:00:00.000Z'

describe('createBookingService (fake repository)', () => {
  let repo: FakeBookingRepository
  let service: ReturnType<typeof createBookingService>

  beforeEach(() => {
    repo = new FakeBookingRepository()
    repo.seedWorker({ id: WORKER_ID, userId: WORKER_USER_ID })
    service = createBookingService({ bookingRepository: repo })
  })

  it('createBooking succeeds when the slot is free', async () => {
    const booking = await service.createBooking({
      workerId: WORKER_ID,
      requesterId: REQUESTER_ID,
      startTime: START,
      endTime: END,
      timezone: 'UTC',
      serviceDescription: 'Fix leaky faucet',
    })

    expect(booking.status).toBe('pending')
    expect(booking.worker.userId).toBe(WORKER_USER_ID)
  })

  it('createBooking rejects a conflicting slot', async () => {
    await service.createBooking({
      workerId: WORKER_ID,
      requesterId: REQUESTER_ID,
      startTime: START,
      endTime: END,
      timezone: 'UTC',
      serviceDescription: 'First booking',
    })

    await expect(
      service.createBooking({
        workerId: WORKER_ID,
        requesterId: 'req-user-2',
        startTime: START,
        endTime: END,
        timezone: 'UTC',
        serviceDescription: 'Overlapping booking',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('createBooking rejects an unknown worker', async () => {
    await expect(
      service.createBooking({
        workerId: 'no-such-worker',
        requesterId: REQUESTER_ID,
        startTime: START,
        endTime: END,
        timezone: 'UTC',
        serviceDescription: 'Booking for missing worker',
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})
