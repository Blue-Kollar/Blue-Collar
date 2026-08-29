import type { Job, JobApplication, JobMessage, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Includes ──────────────────────────────────────────────────────────────────

export const jobInclude = {
  category: true,
  location: true,
  postedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  _count: { select: { applications: true, messages: true } },
} as const

export const applicationInclude = {
  job: { select: { id: true, title: true, postedById: true } },
  worker: { select: { id: true, name: true, avatar: true, email: true, category: true } },
} as const

const messageInclude = {
  sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  recipient: { select: { id: true, firstName: true, lastName: true, avatar: true } },
} as const

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IJobRepository extends IRepository<Job, Prisma.JobCreateInput, Prisma.JobUpdateInput> {
  findWithRelations(id: string): Promise<(Job & { applications: JobApplication[] }) | null>
  findJobs(where: Prisma.JobWhereInput, opts: { skip: number; take: number; orderBy?: Prisma.JobOrderByWithRelationInput }): Promise<Job[]>
  count(where?: Prisma.JobWhereInput): Promise<number>
  updateMany(where: Prisma.JobWhereInput, data: Prisma.JobUpdateManyMutationInput): Promise<number>
  findExpiredOpen(): Promise<{ id: string; title: string; postedById: string }[]>

  findApplicationByJobAndWorker(jobId: string, workerId: string): Promise<JobApplication | null>
  findApplication(id: string): Promise<JobApplication | null>
  createApplication(data: Prisma.JobApplicationUncheckedCreateInput): Promise<JobApplication>
  updateApplication(id: string, data: Prisma.JobApplicationUpdateInput): Promise<JobApplication>
  findApplicationsByJob(jobId: string): Promise<JobApplication[]>
  findApplicationsByWorker(workerId: string, opts: { skip: number; take: number }): Promise<{ data: JobApplication[]; total: number }>

  createMessage(data: Prisma.JobMessageUncheckedCreateInput): Promise<JobMessage>
  findMessages(where: Prisma.JobMessageWhereInput, opts?: { orderBy?: Prisma.JobMessageOrderByWithRelationInput }): Promise<JobMessage[]>
  updateManyMessages(where: Prisma.JobMessageWhereInput, data: Prisma.JobMessageUpdateManyMutationInput): Promise<void>

  findWorkerById(id: string): Promise<{ categoryId: string; curatorId: string } | null>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class JobRepository implements IJobRepository {
  // ── Job CRUD ──────────────────────────────────────────────────────────────

  async findById(id: string): Promise<Job | null> {
    return db.job.findUnique({ where: { id }, include: jobInclude })
  }

  async findWithRelations(id: string) {
    return db.job.findUnique({
      where: { id },
      include: { ...jobInclude, applications: { include: applicationInclude } },
    })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Job[]> {
    return db.job.findMany({ skip: opts.skip, take: opts.take, include: jobInclude, orderBy: { createdAt: 'desc' } })
  }

  async findJobs(
    where: Prisma.JobWhereInput,
    opts: { skip: number; take: number; orderBy?: Prisma.JobOrderByWithRelationInput },
  ): Promise<Job[]> {
    return db.job.findMany({ where, skip: opts.skip, take: opts.take, include: jobInclude, orderBy: opts.orderBy ?? { createdAt: 'desc' } })
  }

  async create(data: Prisma.JobCreateInput): Promise<Job> {
    return db.job.create({ data, include: jobInclude })
  }

  async update(id: string, data: Prisma.JobUpdateInput): Promise<Job> {
    return db.job.update({ where: { id }, data, include: jobInclude })
  }

  async delete(id: string): Promise<Job> {
    return db.job.delete({ where: { id } })
  }

  async count(where?: Prisma.JobWhereInput): Promise<number> {
    return db.job.count({ where })
  }

  async updateMany(where: Prisma.JobWhereInput, data: Prisma.JobUpdateManyMutationInput): Promise<number> {
    const result = await db.job.updateMany({ where, data })
    return result.count
  }

  async findExpiredOpen(): Promise<{ id: string; title: string; postedById: string }[]> {
    return db.job.findMany({
      where: { status: 'open', expiresAt: { lt: new Date() } },
      select: { id: true, title: true, postedById: true },
    })
  }

  // ── Applications ──────────────────────────────────────────────────────────

  async findApplicationByJobAndWorker(jobId: string, workerId: string): Promise<JobApplication | null> {
    return db.jobApplication.findUnique({ where: { jobId_workerId: { jobId, workerId } } })
  }

  async findApplication(id: string): Promise<JobApplication | null> {
    return db.jobApplication.findFirst({ where: { id }, include: applicationInclude })
  }

  async createApplication(data: Prisma.JobApplicationUncheckedCreateInput): Promise<JobApplication> {
    return db.jobApplication.create({ data, include: applicationInclude })
  }

  async updateApplication(id: string, data: Prisma.JobApplicationUpdateInput): Promise<JobApplication> {
    return db.jobApplication.update({ where: { id }, data, include: applicationInclude })
  }

  async findApplicationsByJob(jobId: string): Promise<JobApplication[]> {
    return db.jobApplication.findMany({ where: { jobId }, include: applicationInclude, orderBy: { createdAt: 'desc' } })
  }

  async findApplicationsByWorker(
    workerId: string,
    opts: { skip: number; take: number },
  ): Promise<{ data: JobApplication[]; total: number }> {
    const where = { workerId }
    const [data, total] = await Promise.all([
      db.jobApplication.findMany({ where, skip: opts.skip, take: opts.take, include: applicationInclude, orderBy: { createdAt: 'desc' } }),
      db.jobApplication.count({ where }),
    ])
    return { data, total }
  }

  // ── Messages ──────────────────────────────────────────────────────────────

  async createMessage(data: Prisma.JobMessageUncheckedCreateInput): Promise<JobMessage> {
    return db.jobMessage.create({ data, include: messageInclude })
  }

  async findMessages(
    where: Prisma.JobMessageWhereInput,
    opts: { orderBy?: Prisma.JobMessageOrderByWithRelationInput } = {},
  ): Promise<JobMessage[]> {
    return db.jobMessage.findMany({ where, include: messageInclude, orderBy: opts.orderBy ?? { createdAt: 'asc' } })
  }

  async updateManyMessages(
    where: Prisma.JobMessageWhereInput,
    data: Prisma.JobMessageUpdateManyMutationInput,
  ): Promise<void> {
    await db.jobMessage.updateMany({ where, data })
  }

  // ── Worker lookup ─────────────────────────────────────────────────────────

  async findWorkerById(id: string): Promise<{ categoryId: string; curatorId: string } | null> {
    return db.worker.findUnique({ where: { id }, select: { categoryId: true, curatorId: true } })
  }
}

export const jobRepository = new JobRepository()
