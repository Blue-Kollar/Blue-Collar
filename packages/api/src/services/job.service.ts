import type { Prisma } from '@prisma/client'
import { jobRepository as defaultJobRepository } from '../repositories/job.repository.js'
import { AppError } from '../services/AppError.js'
import { dispatchNotification } from '../services/notification.service.js'
import type { JobServiceDeps } from '../container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createJobService(deps: JobServiceDeps) {
  const { jobRepository: repo } = deps

  /** Auto-expire jobs whose expiresAt has passed, and notify the poster. */
  async function expireJobs() {
    const expired = await repo.findExpiredOpen()
    if (expired.length === 0) return

    await repo.updateMany(
      { id: { in: expired.map((j) => j.id) } },
      { status: 'expired' } as any,
    )

    for (const job of expired) {
      dispatchNotification({
        userId: job.postedById,
        type: 'system',
        title: 'Job listing expired',
        message: `Your job "${job.title}" has expired. Renew it to keep receiving applications.`,
        href: `/jobs/${job.id}`,
        channels: ['inapp', 'email'],
      }).catch(() => {})
    }
  }

  return {
    // ── List / Search ────────────────────────────────────────────────────────

    async listJobs(opts: {
      categoryId?: string
      status?: string
      search?: string
      skills?: string[]
      urgency?: 'low' | 'normal' | 'urgent'
      minBudget?: number
      maxBudget?: number
      page?: number
      limit?: number
    }) {
      await expireJobs()
      const { categoryId, status = 'open', search, skills, urgency, minBudget, maxBudget, page = 1, limit = 20 } = opts

      const where: Prisma.JobWhereInput = {
        ...(status !== 'all' ? { status: status as Prisma.JobWhereInput['status'] } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(urgency ? { urgency } : {}),
        ...(minBudget !== undefined || maxBudget !== undefined
          ? { budget: { ...(minBudget !== undefined ? { gte: minBudget } : {}), ...(maxBudget !== undefined ? { lte: maxBudget } : {}) } }
          : {}),
        ...(search
          ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }, { description: { contains: search, mode: 'insensitive' as const } }] }
          : {}),
        ...(skills && skills.length > 0 ? { skills: { hasSome: skills } } : {}),
      }

      const [data, total] = await Promise.all([
        repo.findJobs(where, { skip: (page - 1) * limit, take: limit }),
        repo.count(where),
      ])
      return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
    },

    async getJob(id: string) {
      await expireJobs()
      const job = await repo.findWithRelations(id)
      if (!job) throw new AppError('Job not found', 404)
      return job
    },

    // ── Skill-based recommendations ──────────────────────────────────────────

    async recommendedJobs(workerId: string, limit = 10) {
      await expireJobs()
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      return repo.findJobs(
        { status: 'open', categoryId: worker.categoryId },
        { skip: 0, take: limit, orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }] as any },
      )
    },

    // ── CRUD ─────────────────────────────────────────────────────────────────

    async createJob(
      data: {
        title: string
        description: string
        budget?: number
        skills?: string[]
        urgency?: 'low' | 'normal' | 'urgent'
        categoryId: string
        locationId?: string
        expiresAt?: string
        escrowAmount?: number
      },
      postedById: string,
    ) {
      return repo.create({
        title: data.title,
        description: data.description,
        budget: data.budget,
        skills: data.skills ?? [],
        urgency: data.urgency ?? 'normal',
        categoryId: data.categoryId,
        locationId: data.locationId,
        postedById,
        escrowAmount: data.escrowAmount,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      } as any)
    },

    async updateJob(
      id: string,
      userId: string,
      data: Partial<{
        title: string
        description: string
        budget: number
        skills: string[]
        urgency: 'low' | 'normal' | 'urgent'
        categoryId: string
        locationId: string
        status: string
        expiresAt: string
        escrowAmount: number
      }>,
    ) {
      const job = await repo.findById(id)
      if (!job) throw new AppError('Job not found', 404)
      if ((job as any).postedById !== userId) throw new AppError('Forbidden', 403)

      return repo.update(id, { ...data, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined } as any)
    },

    async deleteJob(id: string, userId: string) {
      const job = await repo.findById(id)
      if (!job) throw new AppError('Job not found', 404)
      if ((job as any).postedById !== userId) throw new AppError('Forbidden', 403)
      await repo.delete(id)
    },

    // ── Renewal ──────────────────────────────────────────────────────────────

    async renewJob(id: string, userId: string, daysFromNow = 30) {
      const job = await repo.findById(id)
      if (!job) throw new AppError('Job not found', 404)
      if ((job as any).postedById !== userId) throw new AppError('Forbidden', 403)
      if ((job as any).status !== 'open' && (job as any).status !== 'expired') {
        throw new AppError('Only open or expired jobs can be renewed', 400)
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + daysFromNow)

      return repo.update(id, { status: 'open', expiresAt, renewedAt: new Date() } as any)
    },

    // ── My posted jobs ────────────────────────────────────────────────────────

    async myPostedJobs(userId: string, page = 1, limit = 20) {
      const where = { postedById: userId }
      const [data, total] = await Promise.all([
        repo.findJobs(where, { skip: (page - 1) * limit, take: limit }),
        repo.count(where),
      ])
      return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
    },

    // ── Worker's own applications ─────────────────────────────────────────────

    async myApplications(workerId: string, page = 1, limit = 20) {
      const { data, total } = await repo.findApplicationsByWorker(workerId, { skip: (page - 1) * limit, take: limit })
      return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
    },

    // ── Applications ──────────────────────────────────────────────────────────

    async applyToJob(jobId: string, workerId: string, coverLetter?: string, proposedRate?: number) {
      const job = await repo.findById(jobId)
      if (!job) throw new AppError('Job not found', 404)
      if ((job as any).status !== 'open') throw new AppError('Job is not accepting applications', 400)

      const existing = await repo.findApplicationByJobAndWorker(jobId, workerId)
      if (existing) throw new AppError('Already applied to this job', 409)

      const application = await repo.createApplication({ jobId, workerId, coverLetter, proposedRate } as any)

      dispatchNotification({
        userId: (job as any).postedById,
        type: 'system',
        title: 'New application received',
        message: `A worker applied to your job "${(job as any).title}".`,
        href: `/jobs/${jobId}/applications`,
        channels: ['inapp'],
      }).catch(() => {})

      return application
    },

    async listApplications(jobId: string, userId: string) {
      const job = await repo.findById(jobId)
      if (!job) throw new AppError('Job not found', 404)
      if ((job as any).postedById !== userId) throw new AppError('Forbidden', 403)
      return repo.findApplicationsByJob(jobId)
    },

    async updateApplicationStatus(jobId: string, applicationId: string, userId: string, status: 'accepted' | 'rejected') {
      const job = await repo.findById(jobId)
      if (!job) throw new AppError('Job not found', 404)
      if ((job as any).postedById !== userId) throw new AppError('Forbidden', 403)

      const app = await repo.findApplication(applicationId)
      if (!app) throw new AppError('Application not found', 404)

      const updated = await repo.updateApplication(applicationId, { status } as any)

      if (status === 'accepted') {
        await repo.update(jobId, { status: 'filled' } as any)
      }

      // Notify the worker's curator about status change
      const workerRecord = await repo.findWorkerById((app as any).workerId)
      if (workerRecord) {
        dispatchNotification({
          userId: (workerRecord as any).curatorId,
          type: 'system',
          title: `Application ${status}`,
          message: `Your application for "${(updated as any).job.title}" has been ${status}.`,
          href: `/jobs/${jobId}`,
          channels: ['inapp', 'email'],
        }).catch(() => {})
      }

      return updated
    },

    async withdrawApplication(jobId: string, workerId: string) {
      const app = await repo.findApplicationByJobAndWorker(jobId, workerId)
      if (!app) throw new AppError('Application not found', 404)
      if ((app as any).status !== 'pending') throw new AppError('Cannot withdraw a non-pending application', 400)
      return repo.updateApplication(app.id, { status: 'withdrawn' } as any)
    },

    // ── Messaging ─────────────────────────────────────────────────────────────

    async sendMessage(jobId: string, senderId: string, recipientId: string, body: string) {
      const job = await repo.findById(jobId)
      if (!job) throw new AppError('Job not found', 404)

      return repo.createMessage({ jobId, senderId, recipientId, body } as any)
    },

    async listMessages(jobId: string, userId: string) {
      const job = await repo.findById(jobId)
      if (!job) throw new AppError('Job not found', 404)

      await repo.updateManyMessages(
        { jobId, recipientId: userId, readAt: null },
        { readAt: new Date() } as any,
      )

      return repo.findMessages({
        jobId,
        OR: [{ senderId: userId }, { recipientId: userId }],
      })
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createJobService({
  jobRepository: defaultJobRepository,
})

export async function listJobs(opts: {
  categoryId?: string
  status?: string
  search?: string
  skills?: string[]
  urgency?: 'low' | 'normal' | 'urgent'
  minBudget?: number
  maxBudget?: number
  page?: number
  limit?: number
}) {
  return _defaultService.listJobs(opts)
}

export async function getJob(id: string) {
  return _defaultService.getJob(id)
}

export async function recommendedJobs(workerId: string, limit = 10) {
  return _defaultService.recommendedJobs(workerId, limit)
}

export async function createJob(
  data: {
    title: string
    description: string
    budget?: number
    skills?: string[]
    urgency?: 'low' | 'normal' | 'urgent'
    categoryId: string
    locationId?: string
    expiresAt?: string
    escrowAmount?: number
  },
  postedById: string,
) {
  return _defaultService.createJob(data, postedById)
}

export async function updateJob(
  id: string,
  userId: string,
  data: Partial<{
    title: string
    description: string
    budget: number
    skills: string[]
    urgency: 'low' | 'normal' | 'urgent'
    categoryId: string
    locationId: string
    status: string
    expiresAt: string
    escrowAmount: number
  }>,
) {
  return _defaultService.updateJob(id, userId, data)
}

export async function deleteJob(id: string, userId: string) {
  return _defaultService.deleteJob(id, userId)
}

export async function renewJob(id: string, userId: string, daysFromNow = 30) {
  return _defaultService.renewJob(id, userId, daysFromNow)
}

export async function myPostedJobs(userId: string, page = 1, limit = 20) {
  return _defaultService.myPostedJobs(userId, page, limit)
}

export async function myApplications(workerId: string, page = 1, limit = 20) {
  return _defaultService.myApplications(workerId, page, limit)
}

export async function applyToJob(jobId: string, workerId: string, coverLetter?: string, proposedRate?: number) {
  return _defaultService.applyToJob(jobId, workerId, coverLetter, proposedRate)
}

export async function listApplications(jobId: string, userId: string) {
  return _defaultService.listApplications(jobId, userId)
}

export async function updateApplicationStatus(jobId: string, applicationId: string, userId: string, status: 'accepted' | 'rejected') {
  return _defaultService.updateApplicationStatus(jobId, applicationId, userId, status)
}

export async function withdrawApplication(jobId: string, workerId: string) {
  return _defaultService.withdrawApplication(jobId, workerId)
}

export async function sendMessage(jobId: string, senderId: string, recipientId: string, body: string) {
  return _defaultService.sendMessage(jobId, senderId, recipientId, body)
}

export async function listMessages(jobId: string, userId: string) {
  return _defaultService.listMessages(jobId, userId)
}
