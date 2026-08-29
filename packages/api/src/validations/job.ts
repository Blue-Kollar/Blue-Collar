import { z } from 'zod'

export const createJobSchema = z.object({
  title: z.string().min(5).max(120),
  description: z.string().min(20).max(5000),
  budget: z.number().positive().optional(),
  skills: z.array(z.string().min(1).max(60)).max(20).default([]),
  urgency: z.enum(['low', 'normal', 'urgent']).default('normal'),
  categoryId: z.string().min(1),
  locationId: z.string().optional(),
  expiresAt: z.string().datetime().optional(),
  escrowAmount: z.number().positive().optional(),
})

export const updateJobSchema = createJobSchema.partial().extend({
  status: z.enum(['open', 'closed']).optional(),
})

export const applyToJobSchema = z.object({
  workerId: z.string().min(1),
  coverLetter: z.string().min(20).max(2000).optional(),
  proposedRate: z.number().positive().optional(),
})

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['accepted', 'rejected']),
})

export const sendMessageSchema = z.object({
  recipientId: z.string().min(1),
  body: z.string().min(1).max(2000),
})

export const listJobsQuerySchema = z.object({
  categoryId: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  skills: z.string().optional(),          // comma-separated
  urgency: z.enum(['low', 'normal', 'urgent']).optional(),
  minBudget: z.coerce.number().optional(),
  maxBudget: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>
