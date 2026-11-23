import { JobStatus } from '@bluecollar/types';
import type {
  CreateJobRequest,
  UpdateJobRequest,
  ListJobsQuery,
  UpdateApplicationStatusRequest,
} from '@bluecollar/types';
import { z } from 'zod';
import { jobRepository as defaultJobRepository } from '@/repositories/job.repository.js';
import { AppError } from '@/utils/app-error.js';
import { nowUtc, parseUtcDate, addUtcMs } from '@/utils/date.js';
import { dispatchNotification } from '@/services/notification.service.js';
import { buildPaginationMeta } from '@/utils/pagination.js';
import { sanitizeText } from '@/utils/sanitize.js';
import type { JobServiceDeps } from '@/container/types.js';

// ── Query validation / normalization (moved out of the route) ─────────────────

const listJobsQuerySchema = z.object({
  categoryId: z.string().min(1).optional(),
  status: z.string().optional(),
  search: z.string().trim().min(1).optional(),
  skills: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((value) => {
      if (value === undefined) return undefined;
      const list = Array.isArray(value) ? value : value.split(',');
      const cleaned = list.map((s) => s.trim()).filter((s) => s.length > 0);
      return cleaned.length > 0 ? cleaned : undefined;
    }),
  urgency: z.string().optional(),
  minBudget: z.coerce.number().nonnegative().optional(),
  maxBudget: z.coerce.number().nonnegative().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * Validate and normalize raw query params for the job list endpoint.
 * Throws a 400 AppError on invalid input so the route can stay thin.
 */
export function normalizeListJobsQuery(raw: unknown): ListJobsQuery {
  const result = listJobsQuerySchema.safeParse(raw ?? {});
  if (!result.success) {
    throw new AppError('Invalid query parameters', 400);
  }
  return result.data as ListJobsQuery;
}

/** Validate and normalize pagination query params. */
export function normalizePaginationQuery(raw: unknown): { page: number; limit: number } {
  const result = paginationQuerySchema.safeParse(raw ?? {});
  if (!result.success) {
    throw new AppError('Invalid pagination parameters', 400);
  }
  return { page: result.data.page ?? 1, limit: result.data.limit ?? 20 };
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createJobService(deps: JobServiceDeps) {
  const { jobRepository: repo } = deps;

  /** Auto-expire jobs whose expiresAt has passed, and notify the poster. */
  async function expireJobs() {
    const expired = await repo.findExpiredOpen();
    if (expired.length === 0) return;

    await repo.transaction(async (tx) => {
      await tx.updateMany({ id: { in: expired.map((j) => j.id) } }, { status: JobStatus.Expired });
    });

    // Notifications are fire-and-forget and dispatched outside the transaction.
    for (const job of expired) {
      dispatchNotification({
        userId: job.postedById,
        type: 'system',
        title: 'Job listing expired',
        message: `Your job "${job.title}" has expired. Renew it to keep receiving applications.`,
        href: `/jobs/${job.id}`,
        channels: ['inapp', 'email'],
      }).catch(() => {});
    }
  }

  return {
    // ── List / Search ────────────────────────────────────────────────────────

    async listJobs(rawOpts: ListJobsQuery | unknown) {
      await expireJobs();
      const opts = normalizeListJobsQuery(rawOpts);
      const {
        categoryId,
        status = JobStatus.Open,
        search,
        skills,
        urgency,
        minBudget,
        maxBudget,
        page = 1,
        limit = 20,
      } = opts;

      const where = {
        ...(status !== 'all' ? { status } : {}),
        ...(categoryId ? { categoryId } : {}),
        ...(urgency ? { urgency } : {}),
        ...(minBudget !== undefined || maxBudget !== undefined
          ? {
              budget: {
                ...(minBudget !== undefined ? { gte: minBudget } : {}),
                ...(maxBudget !== undefined ? { lte: maxBudget } : {}),
              },
            }
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
          ? { skills: { hasSome: skills as unknown as string[] } }
          : {}),
      };

      const [data, total] = await Promise.all([
        repo.findJobs(where, { skip: (page - 1) * limit, take: limit }),
        repo.count(where),
      ]);
      const lastRecord = data.length > 0 ? data[data.length - 1] : null;
      return { data, meta: buildPaginationMeta(total, page, limit, lastRecord) };
    },

    async getJob(id: string) {
      await expireJobs();
      const job = await repo.findWithRelations(id);
      if (!job) throw new AppError('Job not found', 404);
      return job;
    },

    // ── Skill-based recommendations ──────────────────────────────────────────

    async recommendedJobs(workerId: string, limit = 10) {
      await expireJobs();
      const worker = await repo.findWorkerById(workerId);
      if (!worker) throw new AppError('Worker not found', 404);

      return repo.findJobs(
        { status: JobStatus.Open, categoryId: worker.categoryId },
        { skip: 0, take: limit, orderBy: [{ urgency: 'desc' }, { createdAt: 'desc' }] },
      );
    },

    // ── CRUD ─────────────────────────────────────────────────────────────────

    async createJob(data: CreateJobRequest, postedById: string) {
      return repo.transaction(async (tx) => {
        const job = await tx.create({
          title: sanitizeText(data.title),
          description: sanitizeText(data.description),
          budget: data.budget,
          skills: (data.skills ?? []).map((skill) => sanitizeText(skill)),
          urgency: data.urgency ?? 'normal',
          categoryId: data.categoryId,
          locationId: data.locationId,
          postedById,
          escrowAmount: (data as CreateJobRequest & { escrowAmount?: number }).escrowAmount,
          expiresAt: data.expiresAt ? parseUtcDate(data.expiresAt) : undefined,
        });

        return job;
      });
    },

    async updateJob(id: string, userId: string, data: UpdateJobRequest) {
      const job = await repo.findById(id);
      if (!job) throw new AppError('Job not found', 404);
      if (job.postedById !== userId) throw new AppError('Forbidden', 403);

      return repo.update(id, {
        ...data,
        ...(data.title !== undefined ? { title: sanitizeText(data.title) } : {}),
        ...(data.description !== undefined ? { description: sanitizeText(data.description) } : {}),
        ...(data.skills !== undefined
          ? { skills: data.skills.map((skill) => sanitizeText(skill)) }
          : {}),
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      });
    },

    async deleteJob(id: string, userId: string) {
      const job = await repo.findById(id);
      if (!job) throw new AppError('Job not found', 404);
      if (job.postedById !== userId) throw new AppError('Forbidden', 403);
      await repo.delete(id);
    },

    // ── Renewal ──────────────────────────────────────────────────────────────

    async renewJob(id: string, userId: string, daysFromNow = 30) {
      const job = await repo.findById(id);
      if (!job) throw new AppError('Job not found', 404);
      if (job.postedById !== userId) throw new AppError('Forbidden', 403);
      if (job.status !== JobStatus.Open && job.status !== JobStatus.Expired) {
        throw new AppError('Only open or expired jobs can be renewed', 400);
      }

      const expiresAt = addUtcMs(nowUtc(), daysFromNow * 24 * 60 * 60 * 1000);

      return repo.update(id, { status: 'open', expiresAt, renewedAt: nowUtc() });
    },

    // ── My posted jobs ────────────────────────────────────────────────────────

    async myPostedJobs(userId: string, rawPagination?: unknown, legacyLimit?: number) {
      const { page, limit } =
        typeof rawPagination === 'number' || rawPagination === undefined
          ? { page: (rawPagination as number | undefined) ?? 1, limit: legacyLimit ?? 20 }
          : normalizePaginationQuery(rawPagination);
      const where = { postedById: userId };
      const [data, total] = await Promise.all([
        repo.findJobs(where, { skip: (page - 1) * limit, take: limit }),
        repo.count(where),
      ]);
      const lastRecord = data.length > 0 ? data[data.length - 1] : null;
      return { data, meta: buildPaginationMeta(total, page, limit, lastRecord) };
    },

    // ── Worker's own applications ─────────────────────────────────────────────

    async myApplications(workerId: string, rawPagination?: unknown, legacyLimit?: number) {
      const { page, limit } =
        typeof rawPagination === 'number' || rawPagination === undefined
          ? { page: (rawPagination as number | undefined) ?? 1, limit: legacyLimit ?? 20 }
          : normalizePaginationQuery(rawPagination);
      const { data, total } = await repo.findApplicationsByWorker(workerId, {
        skip: (page - 1) * limit,
        take: limit,
      });
      const lastRecord = data.length > 0 ? data[data.length - 1] : null;
      return { data, meta: buildPaginationMeta(total, page, limit, lastRecord) };
    },

    // ── Applications ──────────────────────────────────────────────────────────

    async applyToJob(jobId: string, workerId: string, coverLetter?: string, proposedRate?: number) {
      const { application, job } = await repo.transaction(async (tx) => {
        const job = await tx.findById(jobId);
        if (!job) throw new AppError('Job not found', 404);
        if (job.status !== JobStatus.Open)
          throw new AppError('Job is not accepting applications', 400);

        const existing = await tx.findApplicationByJobAndWorker(jobId, workerId);
        if (existing) throw new AppError('Already applied to this job', 409);

        const application = await tx.createApplication({
          jobId,
          workerId,
          coverLetter: coverLetter !== undefined ? sanitizeText(coverLetter) : undefined,
          proposedRate,
        });

        return { application, job };
      });

      dispatchNotification({
        userId: job.postedById,
        type: 'system',
        title: 'New application received',
        message: `A worker applied to your job "${job.title}".`,
        href: `/jobs/${jobId}/applications`,
        channels: ['inapp'],
      }).catch(() => {});

      return application;
    },

    async listApplications(jobId: string, userId: string) {
      const job = await repo.findById(jobId);
      if (!job) throw new AppError('Job not found', 404);
      if (job.postedById !== userId) throw new AppError('Forbidden', 403);
      return repo.findApplicationsByJob(jobId);
    },

    async updateApplicationStatus(
      jobId: string,
      applicationId: string,
      userId: string,
      status: UpdateApplicationStatusRequest['status'],
    ) {
      const { updated, workerRecord } = await repo.transaction(async (tx) => {
        const job = await tx.findById(jobId);
        if (!job) throw new AppError('Job not found', 404);
        if (job.postedById !== userId) throw new AppError('Forbidden', 403);

        const app = await tx.findApplication(applicationId);
        if (!app) throw new AppError('Application not found', 404);

        const updated = await tx.updateApplication(applicationId, { status });

        if (status === 'accepted') {
          await tx.update(jobId, { status: JobStatus.Filled });
        }

        const workerRecord = await tx.findWorkerById(app.workerId);

        return { updated, workerRecord };
      });

      // Notify the worker's curator about status change (outside the transaction)
      if (workerRecord) {
        dispatchNotification({
          userId: workerRecord.curatorId,
          type: 'system',
          title: `Application ${status}`,
          message: `Your application for "${updated.job.title}" has been ${status}.`,
          href: `/jobs/${jobId}`,
          channels: ['inapp', 'email'],
        }).catch(() => {});
      }

      return updated;
    },

    async withdrawApplication(jobId: string, workerId: string) {
      const app = await repo.findApplicationByJobAndWorker(jobId, workerId);
      if (!app) throw new AppError('Application not found', 404);
      if (app.status !== 'pending')
        throw new AppError('Cannot withdraw a non-pending application', 400);
      return repo.updateApplication(app.id, { status: 'withdrawn' });
    },

    // ── Messaging ─────────────────────────────────────────────────────────────

    async sendMessage(jobId: string, senderId: string, recipientId: string, body: string) {
      const job = await repo.findById(jobId);
      if (!job) throw new AppError('Job not found', 404);

      return repo.createMessage({ jobId, senderId, recipientId, body });
    },

    async listMessages(jobId: string, userId: string) {
      return repo.transaction(async (tx) => {
        const job = await tx.findById(jobId);
        if (!job) throw new AppError('Job not found', 404);

        await tx.updateManyMessages(
          { jobId, recipientId: userId, readAt: null },
          { readAt: nowUtc() },
        );

        return tx.findMessages({
          jobId,
          OR: [{ senderId: userId }, { recipientId: userId }],
        });
      });
    },
  };
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createJobService({
  jobRepository: defaultJobRepository,
});

export async function listJobs(opts: ListJobsQuery | unknown) {
  return _defaultService.listJobs(opts);
}

export async function getJob(id: string) {
  return _defaultService.getJob(id);
}

export async function recommendedJobs(workerId: string, limit = 10) {
  return _defaultService.recommendedJobs(workerId, limit);
}

export async function createJob(data: CreateJobRequest, postedById: string) {
  return _defaultService.createJob(data, postedById);
}

export async function updateJob(id: string, userId: string, data: UpdateJobRequest) {
  return _defaultService.updateJob(id, userId, data);
}

export async function deleteJob(id: string, userId: string) {
  return _defaultService.deleteJob(id, userId);
}

export async function renewJob(id: string, userId: string, daysFromNow = 30) {
  return _defaultService.renewJob(id, userId, daysFromNow);
}

export async function myPostedJobs(userId: string, rawPagination?: unknown, legacyLimit?: number) {
  return _defaultService.myPostedJobs(userId, rawPagination, legacyLimit);
}

export async function myApplications(
  workerId: string,
  rawPagination?: unknown,
  legacyLimit?: number,
) {
  return _defaultService.myApplications(workerId, rawPagination, legacyLimit);
}

export async function applyToJob(
  jobId: string,
  workerId: string,
  coverLetter?: string,
  proposedRate?: number,
) {
  return _defaultService.applyToJob(jobId, workerId, coverLetter, proposedRate);
}

export async function listApplications(jobId: string, userId: string) {
  return _defaultService.listApplications(jobId, userId);
}

export async function updateApplicationStatus(
  jobId: string,
  applicationId: string,
  userId: string,
  status: UpdateApplicationStatusRequest['status'],
) {
  return _defaultService.updateApplicationStatus(jobId, applicationId, userId, status);
}

export async function withdrawApplication(jobId: string, workerId: string) {
  return _defaultService.withdrawApplication(jobId, workerId);
}

export async function sendMessage(
  jobId: string,
  senderId: string,
  recipientId: string,
  body: string,
) {
  return _defaultService.sendMessage(jobId, senderId, recipientId, body);
}

export async function listMessages(jobId: string, userId: string) {
  return _defaultService.listMessages(jobId, userId);
}
