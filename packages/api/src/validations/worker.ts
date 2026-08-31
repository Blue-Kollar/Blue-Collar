/**
 * Worker validation schemas for the API.
 * Core schemas are imported from @bluecollar/types to stay in sync with the App.
 */
import { z } from 'zod'

export {
  createWorkerSchema as createWorkerRules,
  updateWorkerSchema as updateWorkerRules,
  createReviewSchema as createReviewRules,
} from '@bluecollar/types'

// POST /workers/:id/contact — API-only (no frontend form schema needed)
export const contactRequestRules = z.object({
  message: z.string().min(10, 'Message must be at least 10 characters'),
})

// Advanced search — API-only query parsing
export const advancedSearchRules = z.object({
  query: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radius: z.coerce.number().min(0.1).max(1000).optional(),
  categories: z.string().optional(),
  minRating: z.coerce.number().int().min(1).max(5).optional(),
  maxRating: z.coerce.number().int().min(1).max(5).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isVerified: z.coerce.boolean().optional(),
  sortBy: z.enum(['relevance', 'rating', 'distance', 'newest', 'reviews']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
})
