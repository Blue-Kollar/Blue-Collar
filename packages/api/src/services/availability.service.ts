import { availabilityRepository as defaultAvailabilityRepository } from '../repositories/availability.repository.js'
import { AppError } from '../utils/AppError.js'
import type { AvailabilityServiceDeps } from '../container/types.js'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AvailabilitySlot {
  dayOfWeek: number   // 0=Sun … 6=Sat
  startTime: string   // "HH:MM"
  endTime: string     // "HH:MM"
  timezone?: string
  isRecurring?: boolean
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** Convert "HH:MM" to minutes since midnight */
function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Detect overlapping slots within the same day */
function detectConflicts(slots: AvailabilitySlot[]): string | null {
  const byDay = new Map<number, AvailabilitySlot[]>()
  for (const slot of slots) {
    if (!byDay.has(slot.dayOfWeek)) byDay.set(slot.dayOfWeek, [])
    byDay.get(slot.dayOfWeek)!.push(slot)
  }
  for (const [day, daySlots] of byDay) {
    const sorted = [...daySlots].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    for (let i = 0; i < sorted.length - 1; i++) {
      if (toMinutes(sorted[i].endTime) > toMinutes(sorted[i + 1].startTime)) {
        return `Conflicting slots on day ${day}: ${sorted[i].startTime}-${sorted[i].endTime} overlaps ${sorted[i + 1].startTime}-${sorted[i + 1].endTime}`
      }
    }
  }
  return null
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createAvailabilityService(deps: AvailabilityServiceDeps) {
  const { availabilityRepository: repo } = deps

  return {
    async getAvailability(workerId: string) {
      return repo.findByWorker(workerId)
    },

    async upsertAvailability(workerId: string, slots: AvailabilitySlot[]) {
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      if (!Array.isArray(slots) || slots.length === 0) {
        throw new AppError('Availability slots array is required', 400)
      }

      for (const slot of slots) {
        if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
          throw new AppError('dayOfWeek must be 0–6', 400)
        }
        if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
          throw new AppError(`startTime must be before endTime for day ${slot.dayOfWeek}`, 400)
        }
      }

      const conflict = detectConflicts(slots)
      if (conflict) throw new AppError(conflict, 409)

      await repo.deleteByWorker(workerId)

      return repo.createManySlots(
        slots.map(slot => ({
          workerId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: slot.timezone ?? 'UTC',
          isRecurring: slot.isRecurring ?? true,
        })),
      )
    },

    async addAvailabilitySlot(workerId: string, slot: AvailabilitySlot) {
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) throw new AppError('dayOfWeek must be 0–6', 400)
      if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
        throw new AppError('startTime must be before endTime', 400)
      }

      const existing = await repo.findByWorkerAndDay(workerId, slot.dayOfWeek)
      const conflict = detectConflicts([...existing, slot])
      if (conflict) throw new AppError(conflict, 409)

      return repo.createSlot({
        workerId,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        timezone: slot.timezone ?? 'UTC',
        isRecurring: slot.isRecurring ?? true,
      })
    },

    async deleteAvailabilitySlot(workerId: string, slotId: string) {
      const slot = await repo.findSlotById(workerId, slotId)
      if (!slot) throw new AppError('Availability slot not found', 404)
      await repo.deleteSlot(slotId)
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createAvailabilityService({
  availabilityRepository: defaultAvailabilityRepository,
})

export async function getAvailability(workerId: string) {
  return _defaultService.getAvailability(workerId)
}

export async function upsertAvailability(workerId: string, slots: AvailabilitySlot[]) {
  return _defaultService.upsertAvailability(workerId, slots)
}

export async function addAvailabilitySlot(workerId: string, slot: AvailabilitySlot) {
  return _defaultService.addAvailabilitySlot(workerId, slot)
}

export async function deleteAvailabilitySlot(workerId: string, slotId: string) {
  return _defaultService.deleteAvailabilitySlot(workerId, slotId)
}
