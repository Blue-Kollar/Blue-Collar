// Closes #1855

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BookingStatus } from '@bluecollar/types';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../queue/index.js', () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../config/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/date.js', () => ({
  nowUtc: vi.fn(),
  parseUtcDate: vi.fn((s: string) => (s ? new Date(s) : null)),
  addUtcMs: vi.fn((d: Date, ms: number) => new Date(d.getTime() + ms)),
  formatUtcIso: vi.fn((d: Date) => d.toISOString()),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createBookingService } from '../../services/booking.service.js';
import { nowUtc } from '../../utils/date.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns an ISO string N milliseconds from the given base. */
function isoOffset(base: Date, offsetMs: number) {
  return new Date(base.getTime() + offsetMs).toISOString();
}

/** Build a minimal fake booking record. */
function makeBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking-1',
    workerId: 'worker-1',
    requesterId: 'requester-1',
    startTime: new Date('2030-01-01T10:00:00Z'),
    endTime: new Date('2030-01-01T11:00:00Z'),
    status: BookingStatus.Pending,
    worker: { userId: 'worker-user-1' },
    requester: { id: 'requester-1', firstName: 'Alice' },
    cancellationReason: null,
    ...overrides,
  };
}

/** Build a fake in-memory booking repository. */
function makeRepo() {
  return {
    findWorkerById: vi.fn(),
    findConflicting: vi.fn().mockResolvedValue([]),
    findAvailabilityByWorkerAndDay: vi.fn().mockResolvedValue([]),
    createBooking: vi.fn(),
    findBookingWithWorker: vi.fn(),
    findBookingWithCancelInfo: vi.fn(),
    updateBooking: vi.fn(),
    findWorkerBookings: vi.fn(),
    findRequesterBookings: vi.fn(),
    /** Pass-through transaction for test doubles (no real DB). */
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(makeRepo())),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('booking.service', () => {
  const NOW = new Date('2025-01-01T00:00:00Z');
  // Slots well in the future relative to NOW
  const START = new Date('2030-01-01T10:00:00Z');
  const END = new Date('2030-01-01T11:00:00Z');

  let repo: ReturnType<typeof makeRepo>;
  let service: ReturnType<typeof createBookingService>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(nowUtc).mockReturnValue(NOW);
    repo = makeRepo();
    // Wire transaction so it uses the same repo instance
    repo.transaction.mockImplementation((fn: (tx: typeof repo) => Promise<unknown>) => fn(repo));
    service = createBookingService({ bookingRepository: repo as never });
  });

  // ── createBooking ──────────────────────────────────────────────────────────

  describe('createBooking', () => {
    it('creates a booking on the happy path', async () => {
      repo.findWorkerById.mockResolvedValueOnce({ id: 'worker-1', userId: 'worker-user-1' });
      repo.findAvailabilityByWorkerAndDay.mockResolvedValueOnce([]);
      repo.findConflicting.mockResolvedValueOnce([]);
      const created = makeBooking();
      repo.createBooking.mockResolvedValueOnce(created);

      const result = await service.createBooking({
        workerId: 'worker-1',
        requesterId: 'requester-1',
        startTime: START.toISOString(),
        endTime: END.toISOString(),
        timezone: 'UTC',
      });

      expect(result).toEqual(created);
      expect(repo.createBooking).toHaveBeenCalledOnce();
    });

    it('throws 400 when startTime is in the past', async () => {
      await expect(
        service.createBooking({
          workerId: 'worker-1',
          requesterId: 'requester-1',
          startTime: isoOffset(NOW, -60_000), // 1 minute ago
          endTime: isoOffset(NOW, 3_600_000),
          timezone: 'UTC',
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('future') });
    });

    it('throws 400 when endTime <= startTime', async () => {
      await expect(
        service.createBooking({
          workerId: 'worker-1',
          requesterId: 'requester-1',
          startTime: START.toISOString(),
          endTime: START.toISOString(), // equal = invalid
          timezone: 'UTC',
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('after startTime'),
      });
    });

    it('throws 400 when workerId equals requesterId', async () => {
      await expect(
        service.createBooking({
          workerId: 'same-id',
          requesterId: 'same-id',
          startTime: START.toISOString(),
          endTime: END.toISOString(),
          timezone: 'UTC',
        }),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('yourself') });
    });

    it('throws 404 when the worker does not exist', async () => {
      repo.findWorkerById.mockResolvedValueOnce(null);

      await expect(
        service.createBooking({
          workerId: 'ghost-worker',
          requesterId: 'requester-1',
          startTime: START.toISOString(),
          endTime: END.toISOString(),
          timezone: 'UTC',
        }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when slot is outside the worker availability window', async () => {
      repo.findWorkerById.mockResolvedValueOnce({ id: 'worker-1', userId: 'worker-user-1' });
      // Availability: 08:00–09:00; slot is 10:00–11:00 → not covered
      repo.findAvailabilityByWorkerAndDay.mockResolvedValueOnce([
        { startTime: '08:00', endTime: '09:00' },
      ]);

      await expect(
        service.createBooking({
          workerId: 'worker-1',
          requesterId: 'requester-1',
          startTime: START.toISOString(), // 10:00
          endTime: END.toISOString(), // 11:00
          timezone: 'UTC',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: expect.stringContaining('availability'),
      });
    });

    it('throws 409 when a conflicting booking exists', async () => {
      repo.findWorkerById.mockResolvedValueOnce({ id: 'worker-1', userId: 'worker-user-1' });
      repo.findAvailabilityByWorkerAndDay.mockResolvedValueOnce([]);
      // The existing booking overlaps with the requested slot
      repo.findConflicting.mockResolvedValueOnce([
        { startTime: new Date('2030-01-01T09:30:00Z'), endTime: new Date('2030-01-01T10:30:00Z') },
      ]);

      await expect(
        service.createBooking({
          workerId: 'worker-1',
          requesterId: 'requester-1',
          startTime: START.toISOString(),
          endTime: END.toISOString(),
          timezone: 'UTC',
        }),
      ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('booked') });
    });
  });

  // ── confirmBooking ─────────────────────────────────────────────────────────

  describe('confirmBooking', () => {
    it('confirms a pending booking', async () => {
      const booking = makeBooking();
      repo.findBookingWithWorker.mockResolvedValueOnce(booking);
      const confirmed = makeBooking({ status: BookingStatus.Confirmed });
      repo.updateBooking.mockResolvedValueOnce(confirmed);

      const result = await service.confirmBooking('booking-1', 'worker-1');

      expect(result).toMatchObject({ status: BookingStatus.Confirmed });
      expect(repo.updateBooking).toHaveBeenCalledWith('booking-1', {
        status: BookingStatus.Confirmed,
      });
    });

    it('throws 403 when a different worker tries to confirm', async () => {
      const booking = makeBooking({ workerId: 'worker-1' });
      repo.findBookingWithWorker.mockResolvedValueOnce(booking);

      await expect(service.confirmBooking('booking-1', 'other-worker')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('throws 400 when the booking is not Pending', async () => {
      const booking = makeBooking({ status: BookingStatus.Confirmed });
      repo.findBookingWithWorker.mockResolvedValueOnce(booking);

      await expect(service.confirmBooking('booking-1', 'worker-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ── cancelBooking ──────────────────────────────────────────────────────────

  describe('cancelBooking', () => {
    it('allows the requester to cancel a pending booking', async () => {
      const booking = makeBooking();
      repo.findBookingWithCancelInfo.mockResolvedValueOnce(booking);
      const cancelled = makeBooking({ status: BookingStatus.Cancelled });
      repo.updateBooking.mockResolvedValueOnce(cancelled);

      const result = await service.cancelBooking('booking-1', 'requester-1');

      expect(result).toMatchObject({ status: BookingStatus.Cancelled });
    });

    it('allows the worker to cancel a pending booking', async () => {
      const booking = makeBooking();
      repo.findBookingWithCancelInfo.mockResolvedValueOnce(booking);
      const cancelled = makeBooking({ status: BookingStatus.Cancelled });
      repo.updateBooking.mockResolvedValueOnce(cancelled);

      // worker-user-1 is booking.worker.userId
      const result = await service.cancelBooking('booking-1', 'worker-user-1');

      expect(result).toMatchObject({ status: BookingStatus.Cancelled });
    });

    it('throws 403 when an unrelated user tries to cancel', async () => {
      const booking = makeBooking();
      repo.findBookingWithCancelInfo.mockResolvedValueOnce(booking);

      await expect(service.cancelBooking('booking-1', 'stranger')).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('throws 400 when the booking is already cancelled', async () => {
      const booking = makeBooking({ status: BookingStatus.Cancelled });
      repo.findBookingWithCancelInfo.mockResolvedValueOnce(booking);

      await expect(service.cancelBooking('booking-1', 'requester-1')).rejects.toMatchObject({
        statusCode: 400,
      });
    });
  });

  // ── getMyBookings ──────────────────────────────────────────────────────────

  describe('getMyBookings', () => {
    it('delegates to findWorkerBookings when role is WORKER', async () => {
      const paged = { bookings: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      repo.findWorkerBookings.mockResolvedValueOnce(paged);

      await service.getMyBookings('user-1', 'WORKER');

      expect(repo.findWorkerBookings).toHaveBeenCalledWith('user-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(repo.findRequesterBookings).not.toHaveBeenCalled();
    });

    it('delegates to findRequesterBookings for non-WORKER roles', async () => {
      const paged = { bookings: [], total: 0, page: 1, limit: 20, totalPages: 0 };
      repo.findRequesterBookings.mockResolvedValueOnce(paged);

      await service.getMyBookings('user-1', 'REQUESTER');

      expect(repo.findRequesterBookings).toHaveBeenCalledWith('user-1', {
        page: 1,
        limit: 20,
        status: undefined,
      });
      expect(repo.findWorkerBookings).not.toHaveBeenCalled();
    });
  });
});
