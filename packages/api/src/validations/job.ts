import { z } from 'zod'
import { sanitizedString } from './sanitize'

export const createJobSchema = z.object({
  title: sanitizedString({ min: 5, max: 120 }),
  description: sanitizedString({ min: 20, max: 5000 }),
  budget: z.number().positive().optional(),
  skills: z.array(sanitizedString({ min: 1, max: 60 })).max(20).default([]),
  urgency: z.enum(['low', 'normal', 'urgent']).default('normal'),
  categoryId: z.string().min(1),
  locationId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  escrowAmount: z.number().positive().optional(),
})

export const updateJobSchema = createJobSchema.partial().extend({
  status: z.enum(JOB_STATUSES).optional(),
})

export const applyToJobSchema = z.object({
  workerId: z.string().min(1),
  coverLetter: sanitizedString({ min: 20, max: 2000 }).optional(),
  proposedRate: z.number().positive().optional(),
})

export const updateApplicationStatusSchema = z.object({
  status: z.enum(JOB_APPLICATION_STATUSES),
})

export const sendMessageSchema = z.object({
  recipientId: z.string().min(1),
  body: sanitizedString({ min: 1, max: 2000 }),
})

export const listJobsQuerySchema = z.object({
  categoryId: z.string().max(40).regex(/^[a-z0-9_-]+$/i, 'Invalid category id').optional(),
  status: z.enum(JOB_STATUSES).optional(),
  /**
   * Issue #1236 — bound free-text search param to 200 chars; rejects anything
   * longer to prevent expensive FTS query plans from adversarial inputs.
   */
  search: z.string().max(200).optional(),
  skills: z.string().max(500).optional(),          // comma-separated, bounded
  urgency: z.enum(JOB_URGENCY_LEVELS).optional(),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type { ListJobsQuery }
