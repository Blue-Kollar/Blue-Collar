/**
 * In-memory fake repositories — Issue #1354
 *
 * Implement the same interfaces as the Prisma-backed repositories
 * (packages/api/src/interfaces/repository.interface.ts) but store data in
 * plain arrays/maps. Used to convert integration-style service tests (that
 * previously mocked '../db.js' method-by-method) into fast, isolated unit
 * tests: `createUserService({ userRepository: new FakeUserRepository() })`.
 */
import type { IUserRepository } from '../../repositories/user.repository.js'
import type { IJobRepository } from '../../repositories/job.repository.js'
import type { IBookingRepository, BookingSlot } from '../../repositories/booking.repository.js'

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter}`
}

// ── FakeUserRepository ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FakeUserRepository implements IUserRepository {
  private users = new Map<string, any>()

  seed(user: any): any {
    this.users.set(user.id, user)
    return user
  }

  async findById(id: string) {
    return this.users.get(id) ?? null
  }

  async findAll(opts: { skip?: number; take?: number } = {}) {
    const all = [...this.users.values()].filter((u) => !u.deletedAt)
    const skip = opts.skip ?? 0
    const take = opts.take ?? all.length
    return all.slice(skip, skip + take)
  }

  async create(data: any) {
    const user = { id: nextId('user'), deletedAt: null, ...data }
    this.users.set(user.id, user)
    return user
  }

  async update(id: string, data: any) {
    const existing = this.users.get(id)
    if (!existing) throw new Error(`FakeUserRepository: user ${id} not found`)
    const updated = { ...existing, ...data }
    this.users.set(id, updated)
    return updated
  }

  async delete(id: string) {
    const existing = this.users.get(id)
    if (!existing) throw new Error(`FakeUserRepository: user ${id} not found`)
    const deleted = { ...existing, deletedAt: new Date() }
    this.users.set(id, deleted)
    return deleted
  }

  async count() {
    return [...this.users.values()].filter((u) => !u.deletedAt).length
  }

  async findByEmail(email: string) {
    return [...this.users.values()].find((u) => u.email === email) ?? null
  }

  async findByGoogleId(googleId: string) {
    return [...this.users.values()].find((u) => u.googleId === googleId) ?? null
  }

  async findByResetToken(token: string) {
    return [...this.users.values()].find((u) => u.resetToken === token) ?? null
  }

  async findByVerificationToken(token: string) {
    return [...this.users.values()].find((u) => u.verificationToken === token) ?? null
  }

  async findByReferralCode(code: string) {
    return [...this.users.values()].find((u) => u.referralCode === code) ?? null
  }
}

// ── FakeJobRepository ────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FakeJobRepository implements IJobRepository {
  jobs = new Map<string, any>()
  applications = new Map<string, any>()
  messages: any[] = []

  seedJob(job: any): any {
    this.jobs.set(job.id, job)
    return job
  }

  async findById(id: string) {
    return this.jobs.get(id) ?? null
  }

  async findWithRelations(id: string) {
    const job = this.jobs.get(id)
    if (!job) return null
    return { ...job, applications: [...this.applications.values()].filter((a) => a.jobId === id) }
  }

  async findAll(opts: { skip?: number; take?: number } = {}) {
    return this.findJobs({}, { skip: opts.skip ?? 0, take: opts.take ?? this.jobs.size })
  }

  async findJobs(_where: any, opts: { skip: number; take: number }) {
    return [...this.jobs.values()].slice(opts.skip, opts.skip + opts.take)
  }

  async count() {
    return this.jobs.size
  }

  async create(data: any) {
    const job = { id: nextId('job'), ...data }
    this.jobs.set(job.id, job)
    return job
  }

  async update(id: string, data: any) {
    const existing = this.jobs.get(id)
    if (!existing) throw new Error(`FakeJobRepository: job ${id} not found`)
    const updated = { ...existing, ...data }
    this.jobs.set(id, updated)
    return updated
  }

  async updateMany(where: any, data: any) {
    let n = 0
    for (const [id, job] of this.jobs) {
      if (where.status === undefined || job.status === where.status) {
        this.jobs.set(id, { ...job, ...data })
        n += 1
      }
    }
    return n
  }

  async delete(id: string) {
    const job = this.jobs.get(id)
    this.jobs.delete(id)
    return job
  }

  async findExpiredOpen() {
    return [...this.jobs.values()]
      .filter((j) => j.status === 'open' && j.expiresAt && j.expiresAt < new Date())
      .map((j) => ({ id: j.id, title: j.title, postedById: j.postedById }))
  }

  async findApplicationByJobAndWorker(jobId: string, workerId: string) {
    return [...this.applications.values()].find((a) => a.jobId === jobId && a.workerId === workerId) ?? null
  }

  async findApplication(id: string) {
    return this.applications.get(id) ?? null
  }

  async createApplication(data: any) {
    const application = { id: nextId('application'), ...data }
    this.applications.set(application.id, application)
    return application
  }

  async updateApplication(id: string, data: any) {
    const existing = this.applications.get(id)
    if (!existing) throw new Error(`FakeJobRepository: application ${id} not found`)
    const updated = { ...existing, ...data }
    this.applications.set(id, updated)
    return updated
  }

  async findApplicationsByJob(jobId: string) {
    return [...this.applications.values()].filter((a) => a.jobId === jobId)
  }

  async findApplicationsByWorker(workerId: string, opts: { skip: number; take: number }) {
    const all = [...this.applications.values()].filter((a) => a.workerId === workerId)
    return { data: all.slice(opts.skip, opts.skip + opts.take), total: all.length }
  }

  async createMessage(data: any) {
    const message = { id: nextId('message'), read: false, ...data }
    this.messages.push(message)
    return message
  }

  async findMessages(where: any) {
    return this.messages.filter((m) =>
      Object.entries(where).every(([key, value]) => (m as any)[key] === value),
    )
  }

  async updateManyMessages(where: any, data: any) {
    this.messages = this.messages.map((m) =>
      Object.entries(where).every(([key, value]) => (m as any)[key] === value) ? { ...m, ...data } : m,
    )
  }

  async findWorkerById(_id: string) {
    return null
  }
}

// ── FakeBookingRepository ────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class FakeBookingRepository implements IBookingRepository {
  bookings = new Map<string, any>()
  workers = new Map<string, { id: string; userId: string }>()
  availability: any[] = []

  seedBooking(booking: any): any {
    this.bookings.set(booking.id, booking)
    return booking
  }

  seedWorker(worker: { id: string; userId: string }): void {
    this.workers.set(worker.id, worker)
  }

  async findById(id: string) {
    return this.bookings.get(id) ?? null
  }

  async findAll(opts: { skip?: number; take?: number } = {}) {
    return [...this.bookings.values()].slice(opts.skip ?? 0, (opts.skip ?? 0) + (opts.take ?? this.bookings.size))
  }

  async create(data: any) {
    const booking = { id: nextId('booking'), ...data }
    this.bookings.set(booking.id, booking)
    return booking
  }

  async update(id: string, data: any) {
    return this.updateBooking(id, data)
  }

  async updateBooking(id: string, data: any) {
    const existing = this.bookings.get(id)
    if (!existing) throw new Error(`FakeBookingRepository: booking ${id} not found`)
    const updated = { ...existing, ...data }
    this.bookings.set(id, updated)
    return updated
  }

  async delete(id: string) {
    const booking = this.bookings.get(id)
    this.bookings.delete(id)
    return booking
  }

  async count() {
    return this.bookings.size
  }

  async findWorkerById(id: string) {
    return this.workers.get(id) ?? null
  }

  async findConflicting(workerId: string, startTime: Date, endTime: Date): Promise<BookingSlot[]> {
    return [...this.bookings.values()]
      .filter(
        (b) =>
          b.workerId === workerId &&
          b.status !== 'cancelled' &&
          b.startTime < endTime &&
          b.endTime > startTime,
      )
      .map((b) => ({ startTime: b.startTime, endTime: b.endTime }))
  }

  async findAvailabilityByWorkerAndDay(workerId: string, dayOfWeek: number) {
    return this.availability.filter((a) => a.workerId === workerId && a.dayOfWeek === dayOfWeek)
  }

  async createBooking(data: any) {
    const worker = this.workers.get(data.workerId)
    const booking = {
      id: nextId('booking'),
      ...data,
      worker: { userId: worker?.userId ?? 'unknown-worker-user' },
      requester: { id: data.requesterId, firstName: 'Requester' },
    }
    this.bookings.set(booking.id, booking)
    return booking
  }

  async findBookingWithWorker(id: string) {
    return this.bookings.get(id) ?? null
  }

  async findBookingWithCancelInfo(id: string) {
    return this.bookings.get(id) ?? null
  }

  async findWorkerBookings(workerId: string, opts: { page: number; limit: number; status?: string }) {
    const all = [...this.bookings.values()].filter(
      (b) => b.workerId === workerId && (!opts.status || b.status === opts.status),
    )
    const start = (opts.page - 1) * opts.limit
    return {
      bookings: all.slice(start, start + opts.limit),
      total: all.length,
      page: opts.page,
      limit: opts.limit,
      totalPages: Math.max(1, Math.ceil(all.length / opts.limit)),
    }
  }

  async findRequesterBookings(requesterId: string, opts: { page: number; limit: number; status?: string }) {
    const all = [...this.bookings.values()].filter(
      (b) => b.requesterId === requesterId && (!opts.status || b.status === opts.status),
    )
    const start = (opts.page - 1) * opts.limit
    return {
      bookings: all.slice(start, start + opts.limit),
      total: all.length,
      page: opts.page,
      limit: opts.limit,
      totalPages: Math.max(1, Math.ceil(all.length / opts.limit)),
    }
  }
}
