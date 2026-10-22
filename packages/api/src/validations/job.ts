import { z } from 'zod'
import {
  applicationStatusSchema,
  jobStatusSchema,
  jobUrgencySchema,
} from '@bluecollar/types'
import type { ListJobsQuery } from '@bluecollar/types'
import { sanitizedString } from './worker.js'

export const createJobSchema = z.object({
  title: sanitizedString(120, 5),
  description: sanitizedString(5000, 20),
  budget: z.number().positive().optional(),
  skills: z.array(sanitizedString(60, 1)).max(20).default([]),
  urgency: z.enum(['low', 'normal', 'urgent']).default('normal'),
  categoryId: z.string().min(1),
  locationId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  escrowAmount: z.number().positive().optional(),
})

export const updateJobSchema = createJobSchema.partial().extend({
  status: jobStatusSchema.optional(),
})

export const applyToJobSchema = z.object({
  workerId: z.string().min(1),
  coverLetter: sanitizedString(2000, 20).optional(),
  proposedRate: z.number().positive().optional(),
})

export const updateApplicationStatusSchema = z.object({
  status: applicationStatusSchema,
})

export const sendMessageSchema = z.object({
  recipientId: z.string().min(1),
  body: sanitizedString(2000, 1),
})

export const listJobsQuerySchema = z.object({
  categoryId: z.string().max(40).regex(/^[a-z0-9_-]+$/i, 'Invalid category id').optional(),
  status: jobStatusSchema.optional(),
  /**
   * Issue #1236 — bound free-text search param to 200 chars; rejects anything
   * longer to prevent expensive FTS query plans from adversarial inputs.
   */
  search: z.string().max(200).optional(),
  skills: z.string().max(500).optional(),          // comma-separated, bounded
  urgency: jobUrgencySchema.optional(),
  minBudget: z.coerce.number().min(0).optional(),
  maxBudget: z.coerce.number().min(0).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type { ListJobsQuery }
