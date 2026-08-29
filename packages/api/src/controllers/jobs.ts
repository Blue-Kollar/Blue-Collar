import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { ErrorMessages } from '../constants/errors.js'
import * as jobService from '../services/job.service.js'
import { validate } from '../middleware/validate.js'
import {
  createJobSchema,
  updateJobSchema,
  applyToJobSchema,
  updateApplicationStatusSchema,
  sendMessageSchema,
  listJobsQuerySchema,
} from '../validations/job.js'

// ── Exported validators for use in router ─────────────────────────────────────
export const validateCreateJob = validate(createJobSchema)
export const validateUpdateJob = validate(updateJobSchema)
export const validateApply = validate(applyToJobSchema)
export const validateAppStatus = validate(updateApplicationStatusSchema)
export const validateSendMessage = validate(sendMessageSchema)
export const validateListQuery = validate(listJobsQuerySchema, 'query')

export type JobsService = typeof jobService

/**
 * Builds the jobs route handlers on top of an injected jobs service.
 * Defaults to the real `job.service.js` module so route wiring is unchanged;
 * tests can pass a fake service to exercise handlers without the database.
 */
export function createJobsController(service: JobsService = jobService) {
  return {
    // ── Jobs CRUD ───────────────────────────────────────────────────────────────
    listJobs: catchAsync(async (req: Request, res: Response) => {
      const { categoryId, status, search, skills, urgency, minBudget, maxBudget, page, limit } = req.query as any
      const result = await service.listJobs({
        categoryId, status, search, urgency, minBudget, maxBudget,
        skills: skills ? String(skills).split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        page: Number(page ?? 1),
        limit: Number(limit ?? 20),
      })
      return res.json({ ...result, status: 'success', code: 200 })
    }),

    showJob: catchAsync(async (req: Request, res: Response) => {
      const job = await service.getJob(req.params.id)
      return res.json({ data: job, status: 'success', code: 200 })
    }),

    createJob: catchAsync(async (req: Request, res: Response) => {
      const job = await service.createJob(req.body, req.user!.id)
      return res.status(201).json({ data: job, status: 'success', code: 201 })
    }),

    updateJob: catchAsync(async (req: Request, res: Response) => {
      const job = await service.updateJob(req.params.id, req.user!.id, req.body)
      return res.json({ data: job, status: 'success', code: 200 })
    }),

    deleteJob: catchAsync(async (req: Request, res: Response) => {
      await service.deleteJob(req.params.id, req.user!.id)
      return res.status(204).send()
    }),

    renewJob: catchAsync(async (req: Request, res: Response) => {
      const days = req.body.days ? Number(req.body.days) : 30
      const job = await service.renewJob(req.params.id, req.user!.id, days)
      return res.json({ data: job, status: 'success', code: 200 })
    }),

    // ── Recommendations ─────────────────────────────────────────────────────────
    recommendedJobs: catchAsync(async (req: Request, res: Response) => {
      const jobs = await service.recommendedJobs(req.params.workerId)
      return res.json({ data: jobs, status: 'success', code: 200 })
    }),

    // ── My jobs / applications ──────────────────────────────────────────────────
    myPostedJobs: catchAsync(async (req: Request, res: Response) => {
      const { page, limit } = req.query as any
      const result = await service.myPostedJobs(req.user!.id, Number(page ?? 1), Number(limit ?? 20))
      return res.json({ ...result, status: 'success', code: 200 })
    }),

    myApplications: catchAsync(async (req: Request, res: Response) => {
      const { page, limit } = req.query as any
      // workerId comes from query — worker must pass their worker profile id
      const { workerId } = req.query as any
      if (!workerId) {
        throw new AppError(ErrorMessages.WORKER_ID_REQUIRED, 400, true, ErrorCode.VALIDATION_ERROR)
      }
      const result = await service.myApplications(String(workerId), Number(page ?? 1), Number(limit ?? 20))
      return res.json({ ...result, status: 'success', code: 200 })
    }),

    // ── Applications ─────────────────────────────────────────────────────────────
    applyToJob: catchAsync(async (req: Request, res: Response) => {
      const { workerId, coverLetter, proposedRate } = req.body
      const application = await service.applyToJob(req.params.id, String(workerId), coverLetter, proposedRate)
      return res.status(201).json({ data: application, status: 'success', code: 201 })
    }),

    listApplications: catchAsync(async (req: Request, res: Response) => {
      const applications = await service.listApplications(req.params.id, req.user!.id)
      return res.json({ data: applications, status: 'success', code: 200 })
    }),

    updateApplicationStatus: catchAsync(async (req: Request, res: Response) => {
      const application = await service.updateApplicationStatus(
        req.params.id,
        req.params.applicationId,
        req.user!.id,
        req.body.status,
      )
      return res.json({ data: application, status: 'success', code: 200 })
    }),

    withdrawApplication: catchAsync(async (req: Request, res: Response) => {
      const { workerId } = req.body
      if (!workerId) {
        throw new AppError(ErrorMessages.WORKER_ID_REQUIRED, 400, true, ErrorCode.VALIDATION_ERROR)
      }
      const application = await service.withdrawApplication(req.params.id, String(workerId))
      return res.json({ data: application, status: 'success', code: 200 })
    }),

    // ── Messaging ────────────────────────────────────────────────────────────────
    sendMessage: catchAsync(async (req: Request, res: Response) => {
      const { recipientId, body } = req.body
      const message = await service.sendMessage(req.params.id, req.user!.id, recipientId, body)
      return res.status(201).json({ data: message, status: 'success', code: 201 })
    }),

    listMessages: catchAsync(async (req: Request, res: Response) => {
      const messages = await service.listMessages(req.params.id, req.user!.id)
      return res.json({ data: messages, status: 'success', code: 200 })
    }),
  }
}

const defaultJobsController = createJobsController()

export const {
  listJobs, showJob, createJob, updateJob, deleteJob, renewJob,
  recommendedJobs, myPostedJobs, myApplications,
  applyToJob, listApplications, updateApplicationStatus, withdrawApplication,
  sendMessage, listMessages,
} = defaultJobsController
