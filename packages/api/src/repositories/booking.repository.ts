import type { Availability, Booking, Prisma } from '@prisma/client'
import { BookingStatus } from '@bluecollar/types'
import type { IRepository } from './base.repository.js'
import { db } from '@/db.js'

// ── Transaction client ────────────────────────────────────────────────────────

/**
 * A Prisma client or an interactive-transaction client. Write methods accept
 * this so callers can compose multiple writes atomically (#1814).
 */
export type TxClient = Prisma.TransactionClient | typeof db

// ── Interface ─────────────────────────────────────────────────────────────────

export interface BookingSlot {
  startTime: Date
  endTime: Date
}

export interface PaginatedBookings {
  bookings: Booking[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface CreateBookingWithRelationsInput {
  booking: Prisma.BookingUncheckedCreateInput
  /** Optional related records created in the same transaction as the booking. */
  availability?: Prisma.AvailabilityUncheckedCreateInput[]
}

export interface IBookingRepository extends IRepository<Booking, Prisma.BookingCreateInput, Prisma.BookingUpdateInput> {
  findWorkerById(id: string): Promise<{ id: string; userId: string } | null>
  findWorkersByIds(ids: string[]): Promise<Map<string, { id: string; userId: string }>>
  findConflicting(workerId: string, startTime: Date, endTime: Date): Promise<BookingSlot[]>
  findAvailabilityByWorkerAndDay(workerId: string, dayOfWeek: number): Promise<Availability[]>
  findAvailabilityByWorkerIdsAndDay(workerIds: string[], dayOfWeek: number): Promise<Map<string, Availability[]>>
  createBooking(data: Prisma.BookingUncheckedCreateInput, tx?: TxClient): Promise<Booking & { worker: { userId: string }; requester: { id: string; firstName: string } }>
  createBookingWithRelations(input: CreateBookingWithRelationsInput): Promise<Booking & { worker: { userId: string }; requester: { id: string; firstName: string } }>
  findBookingWithWorker(id: string): Promise<(Booking & { worker: { userId: string }; requester: { id: string; firstName: string } }) | null>
  findBookingWithCancelInfo(id: string): Promise<(Booking & { worker: { userId: string } }) | null>
  updateBooking(id: string, data: Prisma.BookingUpdateInput, tx?: TxClient): Promise<Booking>
  findWorkerBookings(workerId: string, opts: { page: number; limit: number; status?: BookingStatus }): Promise<PaginatedBookings>
  findRequesterBookings(requesterId: string, opts: { page: number; limit: number; status?: BookingStatus }): Promise<PaginatedBookings>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class BookingRepository implements IBookingRepository {
  async findById(id: string): Promise<Booking | null> {
    return db.booking.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Booking[]> {
    return db.booking.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.BookingCreateInput, tx: TxClient = db): Promise<Booking> {
    return tx.booking.create({ data })
  }

  async update(id: string, data: Prisma.BookingUpdateInput, tx: TxClient = db): Promise<Booking> {
    return tx.booking.update({ where: { id }, data })
  }

  async delete(id: string, tx: TxClient = db): Promise<Booking> {
    return tx.booking.delete({ where: { id } })
  }

  async count(where?: Prisma.BookingWhereInput): Promise<number> {
    return db.booking.count({ where })
  }

  async findWorkerById(id: string): Promise<{ id: string; userId: string } | null> {
    const worker = await db.worker.findUnique({ where: { id }, select: { id: true, curatorId: true } })
    return worker ? { id: worker.id, userId: worker.curatorId } : null
  }

  /**
   * Batched worker lookup to avoid N+1 when resolving many bookings (#1813).
   */
  async findWorkersByIds(ids: string[]): Promise<Map<string, { id: string; userId: string }>> {
    const result = new Map<string, { id: string; userId: string }>()
    if (ids.length === 0) return result

    const workers = await db.worker.findMany({
      where: { id: { in: ids } },
      select: { id: true, curatorId: true },
    })
    for (const worker of workers) {
      result.set(worker.id, { id: worker.id, userId: worker.curatorId })
    }
    return result
  }

  async findConflicting(workerId: string, startTime: Date, endTime: Date): Promise<BookingSlot[]> {
    return db.booking.findMany({
      where: {
        workerId,
        status: { in: [BookingStatus.Pending, BookingStatus.Confirmed] },
        OR: [{ startTime: { lt: endTime }, endTime: { gt: startTime } }],
      },
      select: { startTime: true, endTime: true },
    })
  }

  async findAvailabilityByWorkerAndDay(workerId: string, dayOfWeek: number): Promise<Availability[]> {
    return db.availability.findMany({ where: { workerId, dayOfWeek } })
  }

  /**
   * Batched availability lookup for many workers in a single query (#1813).
   */
  async findAvailabilityByWorkerIdsAndDay(workerIds: string[], dayOfWeek: number): Promise<Map<string, Availability[]>> {
    const result = new Map<string, Availability[]>()
    if (workerIds.length === 0) return result

    const rows = await db.availability.findMany({ where: { workerId: { in: workerIds }, dayOfWeek } })
    for (const row of rows) {
      const list = result.get(row.workerId)
      if (list) list.push(row)
      else result.set(row.workerId, [row])
    }
    return result
  }

  async createBooking(data: Prisma.BookingUncheckedCreateInput, tx: TxClient = db) {
    const booking = await tx.booking.create({
      data,
      include: {
        worker: { select: { curatorId: true } },
        requester: { select: { id: true, firstName: true } },
      },
    })
    return { ...booking, worker: { userId: booking.worker.curatorId } }
  }

  /**
   * Creates a booking together with any related records atomically (#1814).
   * All writes share a single transaction, so a failure rolls everything back.
   */
  async createBookingWithRelations(input: CreateBookingWithRelationsInput) {
    return db.$transaction(async (tx) => {
      const booking = await tx.booking.create({
        data: input.booking,
        include: {
          worker: { select: { curatorId: true } },
          requester: { select: { id: true, firstName: true } },
        },
      })

      if (input.availability && input.availability.length > 0) {
        await tx.availability.createMany({ data: input.availability })
      }

      return { ...booking, worker: { userId: booking.worker.curatorId } }
    })
  }

  async findBookingWithWorker(id: string) {
    const booking = await db.booking.findUnique({
      where: { id },
      include: {
        worker: { select: { curatorId: true } },
        requester: { select: { id: true, firstName: true } },
      },
    })
    return booking ? { ...booking, worker: { userId: booking.worker.curatorId } } : null
  }

  async findBookingWithCancelInfo(id: string) {
    const booking = await db.booking.findUnique({
      where: { id },
      include: { worker: { select: { curatorId: true } } },
    })
    return booking ? { ...booking, worker: { userId: booking.worker.curatorId } } : null
  }

  async updateBooking(id: string, data: Prisma.BookingUpdateInput, tx: TxClient = db): Promise<Booking> {
    return tx.booking.update({ where: { id }, data })
  }

  async findWorkerBookings(
    workerId: string,
    opts: { page: number; limit: number; status?: BookingStatus },
  ): Promise<PaginatedBookings> {
    const { page, limit, status } = opts
    const skip = (page - 1) * limit
    const where: Prisma.BookingWhereInput = { workerId, ...(status ? { status } : {}) }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
        include: { requester: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
      }),
      db.booking.count({ where }),
    ])

    return { bookings, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  async findRequesterBookings(
    requesterId: string,
    opts: { page: number; limit: number; status?: BookingStatus },
  ): Promise<PaginatedBookings> {
    const { page, limit, status } = opts
    const skip = (page - 1) * limit
    const where: Prisma.BookingWhereInput = { requesterId, ...(status ? { status } : {}) }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where,
        orderBy: { startTime: 'asc' },
        skip,
        take: limit,
        include: { worker: { select: { id: true, name: true, category: true } } },
      }),
      db.booking.count({ where }),
    ])

    return { bookings, total, page, limit, totalPages: Math.ceil(total / limit) }
  }
}

export const bookingRepository = new BookingRepository()
