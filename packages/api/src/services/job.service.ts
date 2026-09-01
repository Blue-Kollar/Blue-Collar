import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { AppError } from '../services/AppError.js'
import { dispatchNotification } from '../services/notification.service.js'

const jobInclude = {
  category: true,
  location: true,
  postedBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
  _count: { select: { applications: true, messages: true } },
} as const

const applicationInclude = {
  job: { select: { id: true, title: true, postedById: true } },
  worker: { select: { id: true, name: true, avatar: true, email: true, category: true } },
} as const

/** Auto-expire jobs whose expiresAt has passed, and notify the poster. */
async function expireJobs() {
  const expired = await db.job.findMany({
    where: { status: 'open', expiresAt: { lt: new Date() } },
    select: { id: true, title: true, postedById: true },
  })
  if (expired.length === 0) return

  await db.job.updateMany({
    where: { id: { in: expired.map((j) => j.id) } },
    data: { status: 'expired' },
  })

  // Notify each poster (fire-and-forget)
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

// ── List / Search ─────────────────────────────────────────────────────────────

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
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(skills && skills.length > 0
      ? { skills: { hasSome: skills } }
      : {}),
  }

  const [data, total] = await Promise.all([
    db.job.findMany({ where, skip: (page - 1) * limit, take: limit, include: jobInclude, orderBy: { createdAt: 'desc' } }),
    db.job.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

export async function getJob(id: string) {
  await expireJobs()
  const job = await db.job.findUnique({ where: { id }, include: { ...jobInclude, applications: { include: applicationInclude } } })
  if (!job) throw new AppError('Job not found', 404)
  return job
}

// ── Skill-based recommendations for a worker ─────────────────────────────────

export async function recommendedJobs(workerId: string, limit = 10) {
  await expireJobs()
  const worker = await db.worker.findUnique({ where: { id: workerId }, select: { categoryId: true } })
  if (!worker) throw new AppError('Worker not found', 404)

  // Fetch open jobs in the same category, newest first
  const jobs = await db.job.findMany({
    where: { status: 'open', categoryId: worker.categoryId },
    take: limit,
    include: jobInclude,
    orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }],
  })
  return jobs
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

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
  return db.job.create({
    data: {
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
    },
    include: jobInclude,
  })
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
  const job = await db.job.findUnique({ where: { id } })
  if (!job) throw new AppError('Job not found', 404)
  if (job.postedById !== userId) throw new AppError('Forbidden', 403)

  return db.job.update({
    where: { id },
    // The input type includes `expiresAt` as a string (from JSON body), converted to
    // Date above. Prisma's generated JobUpdateInput uses `Date | DateTimeFieldUpdateOperationsInput`;
    // the spread produces a compatible shape but TypeScript can't prove it without the cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma input type vs partial body spread
    data: { ...data, expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined } as any,
    include: jobInclude,
  })
}

export async function deleteJob(id: string, userId: string) {
  const job = await db.job.findUnique({ where: { id } })
  if (!job) throw new AppError('Job not found', 404)
  if (job.postedById !== userId) throw new AppError('Forbidden', 403)
  await db.job.delete({ where: { id } })
}

// ── Renewal ───────────────────────────────────────────────────────────────────

export async function renewJob(id: string, userId: string, daysFromNow = 30) {
  const job = await db.job.findUnique({ where: { id } })
  if (!job) throw new AppError('Job not found', 404)
  if (job.postedById !== userId) throw new AppError('Forbidden', 403)
  if (job.status !== 'open' && job.status !== 'expired') throw new AppError('Only open or expired jobs can be renewed', 400)

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + daysFromNow)

  return db.job.update({
    where: { id },
    data: { status: 'open', expiresAt, renewedAt: new Date() },
    include: jobInclude,
  })
}

// ── My posted jobs ────────────────────────────────────────────────────────────

export async function myPostedJobs(userId: string, page = 1, limit = 20) {
  const where = { postedById: userId }
  const [data, total] = await Promise.all([
    db.job.findMany({ where, skip: (page - 1) * limit, take: limit, include: jobInclude, orderBy: { createdAt: 'desc' } }),
    db.job.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

// ── Worker's own applications ─────────────────────────────────────────────────

export async function myApplications(workerId: string, page = 1, limit = 20) {
  const where = { workerId }
  const [data, total] = await Promise.all([
    db.jobApplication.findMany({ where, skip: (page - 1) * limit, take: limit, include: applicationInclude, orderBy: { createdAt: 'desc' } }),
    db.jobApplication.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

// ── Applications ──────────────────────────────────────────────────────────────

export async function applyToJob(
  jobId: string,
  workerId: string,
  coverLetter?: string,
  proposedRate?: number,
) {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) throw new AppError('Job not found', 404)
  if (job.status !== 'open') throw new AppError('Job is not accepting applications', 400)

  const existing = await db.jobApplication.findUnique({ where: { jobId_workerId: { jobId, workerId } } })
  if (existing) throw new AppError('Already applied to this job', 409)

  const application = await db.jobApplication.create({
    data: { jobId, workerId, coverLetter, proposedRate },
    include: applicationInclude,
  })

  // Notify job poster about the new application
  dispatchNotification({
    userId: job.postedById,
    type: 'system',
    title: 'New application received',
    message: `A worker applied to your job "${job.title}".`,
    href: `/jobs/${jobId}/applications`,
    channels: ['inapp'],
  }).catch(() => {})

  return application
}

export async function listApplications(jobId: string, userId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) throw new AppError('Job not found', 404)
  if (job.postedById !== userId) throw new AppError('Forbidden', 403)

  return db.jobApplication.findMany({
    where: { jobId },
    include: applicationInclude,
    orderBy: { createdAt: 'desc' },
  })
}

export async function updateApplicationStatus(
  jobId: string,
  applicationId: string,
  userId: string,
  status: 'accepted' | 'rejected',
) {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) throw new AppError('Job not found', 404)
  if (job.postedById !== userId) throw new AppError('Forbidden', 403)

  const app = await db.jobApplication.findFirst({ where: { id: applicationId, jobId } })
  if (!app) throw new AppError('Application not found', 404)

  const updated = await db.jobApplication.update({
    where: { id: applicationId },
    data: { status },
    include: applicationInclude,
  })

  if (status === 'accepted') {
    await db.job.update({ where: { id: jobId }, data: { status: 'filled' } })
  }

  // Notify the worker (curator who owns the worker profile) about status change
  const workerRecord = await db.worker.findUnique({
    where: { id: app.workerId },
    select: { curatorId: true },
  })
  if (workerRecord) {
    dispatchNotification({
      userId: workerRecord.curatorId,
      type: 'system',
      title: `Application ${status}`,
      message: `Your application for "${updated.job.title}" has been ${status}.`,
      href: `/jobs/${jobId}`,
      channels: ['inapp', 'email'],
    }).catch(() => {})
  }

  return updated
}

export async function withdrawApplication(jobId: string, workerId: string) {
  const app = await db.jobApplication.findUnique({ where: { jobId_workerId: { jobId, workerId } } })
  if (!app) throw new AppError('Application not found', 404)
  if (app.status !== 'pending') throw new AppError('Cannot withdraw a non-pending application', 400)
  return db.jobApplication.update({
    where: { id: app.id },
    data: { status: 'withdrawn' },
    include: applicationInclude,
  })
}

// ── Messaging ─────────────────────────────────────────────────────────────────

export async function sendMessage(jobId: string, senderId: string, recipientId: string, body: string) {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) throw new AppError('Job not found', 404)

  return db.jobMessage.create({
    data: { jobId, senderId, recipientId, body },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
  })
}

export async function listMessages(jobId: string, userId: string) {
  const job = await db.job.findUnique({ where: { id: jobId } })
  if (!job) throw new AppError('Job not found', 404)

  // Mark messages to this user as read
  await db.jobMessage.updateMany({
    where: { jobId, recipientId: userId, readAt: null },
    data: { readAt: new Date() },
  })

  return db.jobMessage.findMany({
    where: { jobId, OR: [{ senderId: userId }, { recipientId: userId }] },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, avatar: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, avatar: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
}
