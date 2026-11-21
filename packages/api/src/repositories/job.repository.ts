import type { Job, JobApplication, JobMessage, Prisma } from '@prisma/client'
import { JobStatus } from '@bluecollar/types'
import type { IRepository } from './base.repository.js'
import { db } from '@/db.js'

// ── Transaction client ────────────────────────────────────────────────────────

/**
 * A Prisma client or interactive-transaction client. Write methods accept an
 * optional `tx` so multi-step flows can be wrapped in a single transaction
 * (#1814) while remaining callable outside one.
 */
export type TxClient = Prisma.TransactionClient | typeof db

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

type ApplicationWithRelations = Prisma.JobApplicationGetPayload<{ include: typeof applicationInclude }>

export interface IJobRepository extends IRepository<Job, Prisma.JobUncheckedCreateInput, Prisma.JobUncheckedUpdateInput> {
  findWithRelations(id: string): Promise<(Job & { applications: JobApplication[] }) | null>
  findJobs(
    where: Prisma.JobWhereInput,
    opts: { skip: number; take: number; orderBy?: Prisma.JobOrderByWithRelationInput | Prisma.JobOrderByWithRelationInput[] },
  ): Promise<Job[]>
  /** Batched fetch of jobs with relations in a single query (avoids N+1). */
  findJobsWithRelations(
    where: Prisma.JobWhereInput,
    opts: { skip: number; take: number; orderBy?: Prisma.JobOrderByWithRelationInput | Prisma.JobOrderByWithRelationInput[] },
  ): Promise<Job[]>
  count(where?: Prisma.JobWhereInput): Promise<number>
  updateMany(where: Prisma.JobWhereInput, data: Prisma.JobUpdateManyMutationInput, tx?: TxClient): Promise<number>
  findExpiredOpen(): Promise<{ id: string; title: string; postedById: string }[]>

  findApplicationByJobAndWorker(jobId: string, workerId: string): Promise<JobApplication | null>
  findApplication(id: string): Promise<ApplicationWithRelations | null>
  createApplication(data: Prisma.JobApplicationUncheckedCreateInput, tx?: TxClient): Promise<JobApplication>
  updateApplication(id: string, data: Prisma.JobApplicationUncheckedUpdateInput, tx?: TxClient): Promise<ApplicationWithRelations>
  findApplicationsByJob(jobId: string): Promise<JobApplication[]>
  findApplicationsByWorker(workerId: string, opts: { skip: number; take: number }): Promise<{ data: JobApplication[]; total: number }>

  createMessage(data: Prisma.JobMessageUncheckedCreateInput, tx?: TxClient): Promise<JobMessage>
  findMessages(where: Prisma.JobMessageWhereInput, opts?: { orderBy?: Prisma.JobMessageOrderByWithRelationInput }): Promise<JobMessage[]>
  updateManyMessages(where: Prisma.JobMessageWhereInput, data: Prisma.JobMessageUpdateManyMutationInput, tx?: TxClient): Promise<void>

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
    opts: { skip: number; take: number; orderBy?: Prisma.JobOrderByWithRelationInput | Prisma.JobOrderByWithRelationInput[] },
  ): Promise<Job[]> {
    return db.job.findMany({ where, skip: opts.skip, take: opts.take, include: jobInclude, orderBy: opts.orderBy ?? { createdAt: 'desc' } })
  }

  async findJobsWithRelations(
    where: Prisma.JobWhereInput,
    opts: { skip: number; take: number; orderBy?: Prisma.JobOrderByWithRelationInput | Prisma.JobOrderByWithRelationInput[] },
  ): Promise<Job[]> {
    return db.job.findMany({
      where,
      skip: opts.skip,
      take: opts.take,
      include: { ...jobInclude, applications: { include: applicationInclude } },
      orderBy: opts.orderBy ?? { createdAt: 'desc' },
    })
  }

  async create(data: Prisma.JobUncheckedCreateInput, tx: TxClient = db): Promise<Job> {
    return tx.job.create({ data, include: jobInclude })
  }

  async update(id: string, data: Prisma.JobUncheckedUpdateInput, tx: TxClient = db): Promise<Job> {
    return tx.job.update({ where: { id }, data, include: jobInclude })
  }

  async delete(id: string, tx: TxClient = db): Promise<Job> {
    return tx.job.delete({ where: { id } })
  }

  async count(where?: Prisma.JobWhereInput): Promise<number> {
    return db.job.count({ where })
  }

  async updateMany(where: Prisma.JobWhereInput, data: Prisma.JobUpdateManyMutationInput, tx: TxClient = db): Promise<number> {
    const result = await tx.job.updateMany({ where, data })
    return result.count
  }

  async findExpiredOpen(): Promise<{ id: string; title: string; postedById: string }[]> {
    return db.job.findMany({
      where: { status: JobStatus.Open, expiresAt: { lt: new Date() } },
      select: { id: true, title: true, postedById: true },
    })
  }

  // ── Applications ──────────────────────────────────────────────────────────

  async findApplicationByJobAndWorker(jobId: string, workerId: string): Promise<JobApplication | null> {
    return db.jobApplication.findUnique({ where: { jobId_workerId: { jobId, workerId } } })
  }

  async findApplication(id: string): Promise<ApplicationWithRelations | null> {
    return db.jobApplication.findFirst({ where: { id }, include: applicationInclude })
  }

  async createApplication(data: Prisma.JobApplicationUncheckedCreateInput, tx: TxClient = db): Promise<JobApplication> {
    return tx.jobApplication.create({ data, include: applicationInclude })
  }

  async updateApplication(
    id: string,
    data: Prisma.JobApplicationUncheckedUpdateInput,
    tx: TxClient = db,
  ): Promise<ApplicationWithRelations> {
    return tx.jobApplication.update({ where: { id }, data, include: applicationInclude })
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

  async createMessage(data: Prisma.JobMessageUncheckedCreateInput, tx: TxClient = db): Promise<JobMessage> {
    return tx.jobMessage.create({ data, include: messageInclude })
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
    tx: TxClient = db,
  ): Promise<void> {
    await tx.jobMessage.updateMany({ where, data })
  }

  // ── Worker lookup ─────────────────────────────────────────────────────────

  async findWorkerById(id: string): Promise<{ categoryId: string; curatorId: string } | null> {
    return db.worker.findUnique({ where: { id }, select: { categoryId: true, curatorId: true } })
  }
}

export const jobRepository = new JobRepository()
