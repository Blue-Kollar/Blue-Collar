import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'

export interface AvailabilitySlot {
  dayOfWeek: number   // 0=Sun … 6=Sat
  startTime: string   // "HH:MM"
  endTime: string     // "HH:MM"
  timezone?: string
  isRecurring?: boolean
}

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

export async function getAvailability(workerId: string) {
  return db.availability.findMany({
    where: { workerId },
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  })
}

export async function upsertAvailability(workerId: string, slots: AvailabilitySlot[]) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  if (!Array.isArray(slots) || slots.length === 0) {
    throw new AppError('Availability slots array is required', 400)
  }

  // Validate each slot
  for (const slot of slots) {
    if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) {
      throw new AppError('dayOfWeek must be 0–6', 400)
    }
    if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
      throw new AppError(`startTime must be before endTime for day ${slot.dayOfWeek}`, 400)
    }
  }

  // Conflict detection
  const conflict = detectConflicts(slots)
  if (conflict) throw new AppError(conflict, 409)

  await db.availability.deleteMany({ where: { workerId } })

  return db.availability.createMany({
    data: slots.map(slot => ({
      workerId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      timezone: slot.timezone ?? 'UTC',
      isRecurring: slot.isRecurring ?? true,
    })),
  })
}

export async function addAvailabilitySlot(workerId: string, slot: AvailabilitySlot) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  if (slot.dayOfWeek < 0 || slot.dayOfWeek > 6) throw new AppError('dayOfWeek must be 0–6', 400)
  if (toMinutes(slot.startTime) >= toMinutes(slot.endTime)) {
    throw new AppError('startTime must be before endTime', 400)
  }

  // Check conflicts with existing slots on the same day
  const existing = await db.availability.findMany({ where: { workerId, dayOfWeek: slot.dayOfWeek } })
  const conflict = detectConflicts([...existing, slot])
  if (conflict) throw new AppError(conflict, 409)

  return db.availability.create({
    data: {
      workerId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      timezone: slot.timezone ?? 'UTC',
      isRecurring: slot.isRecurring ?? true,
    },
  })
}

export async function deleteAvailabilitySlot(workerId: string, slotId: string) {
  const slot = await db.availability.findFirst({ where: { id: slotId, workerId } })
  if (!slot) throw new AppError('Availability slot not found', 404)
  await db.availability.delete({ where: { id: slotId } })
}
