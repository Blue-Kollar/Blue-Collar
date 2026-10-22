import type { Availability, Booking, Prisma } from '@prisma/client'
import { BookingStatus } from '@bluecollar/types'
import type { IRepository } from './base.repository.js'
import { db } from '@/db.js'

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

export interface IBookingRepository extends IRepository<Booking, Prisma.BookingCreateInput, Prisma.BookingUpdateInput> {
  findWorkerById(id: string): Promise<{ id: string; userId: string } | null>
  findConflicting(workerId: string, startTime: Date, endTime: Date): Promise<BookingSlot[]>
  findAvailabilityByWorkerAndDay(workerId: string, dayOfWeek: number): Promise<Availability[]>
  createBooking(data: Prisma.BookingUncheckedCreateInput): Promise<Booking & { worker: { userId: string }; requester: { id: string; firstName: string } }>
  findBookingWithWorker(id: string): Promise<(Booking & { worker: { userId: string }; requester: { id: string; firstName: string } }) | null>
  findBookingWithCancelInfo(id: string): Promise<(Booking & { worker: { userId: string } }) | null>
  updateBooking(id: string, data: Prisma.BookingUpdateInput): Promise<Booking>
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

  async create(data: Prisma.BookingCreateInput): Promise<Booking> {
    return db.booking.create({ data })
  }

  async update(id: string, data: Prisma.BookingUpdateInput): Promise<Booking> {
    return db.booking.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Booking> {
    return db.booking.delete({ where: { id } })
  }

  async count(where?: Prisma.BookingWhereInput): Promise<number> {
    return db.booking.count({ where })
  }

  async findWorkerById(id: string): Promise<{ id: string; userId: string } | null> {
    const worker = await db.worker.findUnique({ where: { id }, select: { id: true, curatorId: true } })
    return worker ? { id: worker.id, userId: worker.curatorId } : null
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

  async createBooking(data: Prisma.BookingUncheckedCreateInput) {
    const booking = await db.booking.create({
      data,
      include: {
        worker: { select: { curatorId: true } },
        requester: { select: { id: true, firstName: true } },
      },
    })
    return { ...booking, worker: { userId: booking.worker.curatorId } }
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

  async updateBooking(id: string, data: Prisma.BookingUpdateInput): Promise<Booking> {
    return db.booking.update({ where: { id }, data })
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
