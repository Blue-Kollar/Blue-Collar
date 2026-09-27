import type { Availability, Prisma, Worker } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IAvailabilityRepository extends IRepository<Availability, Prisma.AvailabilityCreateInput, Prisma.AvailabilityUpdateInput> {
  findWorkerById(id: string): Promise<Worker | null>
  findByWorker(workerId: string): Promise<Availability[]>
  findByWorkerAndDay(workerId: string, dayOfWeek: number): Promise<Availability[]>
  deleteByWorker(workerId: string): Promise<void>
  createManySlots(data: Prisma.AvailabilityCreateManyInput[]): Promise<void>
  createSlot(data: Prisma.AvailabilityUncheckedCreateInput): Promise<Availability>
  findSlotById(workerId: string, slotId: string): Promise<Availability | null>
  deleteSlot(id: string): Promise<void>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class AvailabilityRepository implements IAvailabilityRepository {
  async findById(id: string): Promise<Availability | null> {
    return db.availability.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Availability[]> {
    return db.availability.findMany({ skip: opts.skip, take: opts.take, orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] })
  }

  async create(data: Prisma.AvailabilityCreateInput): Promise<Availability> {
    return db.availability.create({ data })
  }

  async update(id: string, data: Prisma.AvailabilityUpdateInput): Promise<Availability> {
    return db.availability.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Availability> {
    return db.availability.delete({ where: { id } })
  }

  async count(where?: Prisma.AvailabilityWhereInput): Promise<number> {
    return db.availability.count({ where })
  }

  async findWorkerById(id: string): Promise<Worker | null> {
    return db.worker.findUnique({ where: { id } })
  }

  async findByWorker(workerId: string): Promise<Availability[]> {
    return db.availability.findMany({
      where: { workerId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    })
  }

  async findByWorkerAndDay(workerId: string, dayOfWeek: number): Promise<Availability[]> {
    return db.availability.findMany({ where: { workerId, dayOfWeek } })
  }

  async deleteByWorker(workerId: string): Promise<void> {
    await db.availability.deleteMany({ where: { workerId } })
  }

  async createManySlots(data: Prisma.AvailabilityCreateManyInput[]): Promise<void> {
    await db.availability.createMany({ data })
  }

  async createSlot(data: Prisma.AvailabilityUncheckedCreateInput): Promise<Availability> {
    return db.availability.create({ data })
  }

  async findSlotById(workerId: string, slotId: string): Promise<Availability | null> {
    return db.availability.findFirst({ where: { id: slotId, workerId } })
  }

  async deleteSlot(id: string): Promise<void> {
    await db.availability.delete({ where: { id } })
  }
}

export const availabilityRepository = new AvailabilityRepository()
