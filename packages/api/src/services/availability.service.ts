import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'

export async function getAvailability(workerId: string) {
  return db.availability.findMany({
    where: { workerId },
    orderBy: { dayOfWeek: 'asc' }
  })
}

export async function upsertAvailability(workerId: string, availability: Array<{ dayOfWeek: number; startTime: string; endTime: string }>) {
  // Verify worker exists
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  // Delete existing availability for this worker
  await db.availability.deleteMany({ where: { workerId } })

  // Create new availability entries
  return Promise.all(
    availability.map(slot =>
      db.availability.create({
        data: {
          workerId,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime
        }
      })
    )
  )
}
