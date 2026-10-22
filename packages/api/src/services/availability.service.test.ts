import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createAvailabilityService } from './availability.service.js'

// ── Mock repo ────────────────────────────────────────────────────────────────

const mockRepo = {
  findByWorker: vi.fn(),
  findWorkerById: vi.fn(),
  deleteByWorker: vi.fn(),
  createManySlots: vi.fn(),
  findByWorkerAndDay: vi.fn(),
  createSlot: vi.fn(),
  findSlotById: vi.fn(),
  deleteSlot: vi.fn(),
} as any

const service = createAvailabilityService({ availabilityRepository: mockRepo })

beforeEach(() => {
  vi.clearAllMocks()
  mockRepo.findWorkerById.mockResolvedValue({ id: 'worker-1' })
  mockRepo.createManySlots.mockImplementation((slots: unknown) => Promise.resolve(slots))
})

// ── UTC-normalized conflict detection (issue #1355) ─────────────────────────

describe('upsertAvailability — timezone/UTC handling', () => {
  it('accepts non-overlapping slots that share the same fixed UTC offset', async () => {
    await expect(
      service.upsertAvailability('worker-1', [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', timezone: 'UTC' },
        { dayOfWeek: 1, startTime: '13:00', endTime: '17:00', timezone: 'UTC' },
      ]),
    ).resolves.toBeDefined()
  })

  it('detects a conflict between two UTC slots that overlap', async () => {
    await expect(
      service.upsertAvailability('worker-1', [
        { dayOfWeek: 1, startTime: '09:00', endTime: '12:00', timezone: 'UTC' },
        { dayOfWeek: 1, startTime: '11:00', endTime: '15:00', timezone: 'UTC' },
      ]),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('correctly compares slots submitted in different fixed offsets by normalizing to UTC', async () => {
    // 09:00 at +02:00 is 07:00 UTC; 08:00 at UTC starts before that slot ends
    // (07:00-10:00 UTC), so these DO overlap once normalized — this would
    // previously have been missed by naive HH:MM string comparison.
    await expect(
      service.upsertAvailability('worker-1', [
        { dayOfWeek: 2, startTime: '09:00', endTime: '12:00', timezone: '+02:00' },
        { dayOfWeek: 2, startTime: '08:00', endTime: '09:30', timezone: 'UTC' },
      ]),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('does not report a false conflict once offsets are normalized to UTC', async () => {
    // 09:00-12:00 at +02:00 is 07:00-10:00 UTC; 10:00-12:00 at UTC starts
    // exactly when the first slot ends, so there is no overlap.
    await expect(
      service.upsertAvailability('worker-1', [
        { dayOfWeek: 3, startTime: '09:00', endTime: '12:00', timezone: '+02:00' },
        { dayOfWeek: 3, startTime: '10:00', endTime: '12:00', timezone: 'UTC' },
      ]),
    ).resolves.toBeDefined()
  })

  it('handles a DST-boundary transition (offset changing from +00:00 to +01:00) without corrupting comparisons', async () => {
    // Simulates a worker whose recurring slot was saved before a DST
    // transition (+00:00) alongside a newly-added slot saved after the
    // transition (+01:00 local, e.g. BST). Both must be compared on the
    // same UTC axis rather than by raw wall-clock string.
    const preDst = { dayOfWeek: 0, startTime: '23:00', endTime: '23:59', timezone: '+00:00' }
    const postDst = { dayOfWeek: 0, startTime: '00:30', endTime: '01:00', timezone: '+01:00' }
    // preDst: 23:00-23:59 UTC. postDst: 00:30-01:00 local(+1) = 23:30-00:00 UTC
    // (wraps past midnight, normalized into [0,1440)) → these DO overlap.
    await expect(
      service.upsertAvailability('worker-1', [preDst, postDst]),
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('defaults missing timezone to UTC for storage', async () => {
    await service.upsertAvailability('worker-1', [
      { dayOfWeek: 4, startTime: '09:00', endTime: '10:00' },
    ])
    expect(mockRepo.createManySlots).toHaveBeenCalledWith([
      expect.objectContaining({ timezone: 'UTC' }),
    ])
  })
})
