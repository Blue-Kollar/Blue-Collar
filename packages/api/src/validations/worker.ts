import { z } from 'zod'
import { emailField, nameField, phoneField } from './shared.js'

// POST /workers
export const createWorkerRules = z
  .object({
    name: nameField,
    categoryId: z.string().min(1),
    phone: phoneField,
    email: emailField.optional(),
    bio: z.string().optional(),
    walletAddress: z.string().optional(),
  })
  .refine((d) => d.phone || d.email, {
    message: 'Either phone or email is required',
    path: ['phone'],
  })

// PUT /workers/:id — all fields optional
export const updateWorkerRules = z.object({
  name: nameField.optional(),
  categoryId: z.string().optional(),
  phone: phoneField,
  email: emailField.optional(),
  bio: z.string().optional(),
  walletAddress: z.string().optional(),
})

// POST /workers/:id/reviews
export const createReviewRules = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

// POST /workers/:id/contact
export const contactRequestRules = z.object({
  message: z.string().min(10),
})

// Advanced search and filtering
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

/**
 * Issue #1236 — Validate and sanitize GET /workers list query parameters.
 *
 * Without this schema, free-text `search`, comma-separated `categories`, and
 * numeric filters were passed to the database layer with only XSS/SQL stripping
 * in `sanitize.ts`.  This schema adds strict type-coercion and range checks so
 * malformed inputs never reach Prisma or the raw SQL search path.
 *
 * Injection defence layers (defence-in-depth):
 *   1. `sanitize.ts`     — XSS cleaning + SQL/WAF pattern removal (runs first)
 *   2. This Zod schema   — type coercion + range/length constraints (this layer)
 *   3. Prisma/pg         — parameterised queries (last line of defence)
 */
export const listWorkersQuerySchema = z.object({
  // Free-text search — bounded to 200 chars so it cannot be used as a DOS vector
  search: z.string().max(200).optional(),

  // Language config for FTS — must be one of the PG regconfig identifiers
  lang: z
    .string()
    .regex(
      /^(simple|english|french|german|spanish|portuguese|italian|dutch|russian|arabic)$/i,
      'Invalid language config',
    )
    .optional(),

  // Single category UUID (Cuid2 / UUID v4 pattern accepted by Prisma)
  category: z
    .string()
    .max(40)
    .regex(/^[a-z0-9_-]+$/i, 'Invalid category id')
    .optional(),

  // Comma-separated category IDs — each validated individually
  categories: z
    .string()
    .max(500)
    .regex(/^[a-z0-9_,\- ]+$/i, 'Invalid categories format')
    .optional(),

  // Location filters
  city:    z.string().max(100).optional(),
  state:   z.string().max(100).optional(),
  country: z.string().max(100).optional(),

  // Numeric filters with sensible bounds
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxRating: z.coerce.number().min(1).max(5).optional(),
  available: z.coerce.number().int().min(0).max(6).optional(), // day of week
  listedSince: z.coerce.number().int().min(0).max(10).optional(), // years, max 10

  // Geo
  lat:    z.coerce.number().min(-90).max(90).optional(),
  lng:    z.coerce.number().min(-180).max(180).optional(),
  radius: z.coerce.number().min(0.1).max(1000).optional(),

  // Sort
  sortBy:    z.enum(['rating', 'newest', 'oldest', 'name', 'relevance', 'distance']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),

  // Boolean flags — coerce string 'true'/'false' from query string
  isVerified: z.coerce.boolean().optional(),

  // Pagination
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
})

/**
 * Issue #1236 — Validate GET /workers/search query parameters.
 *
 * The `q` / `query` param is the free-text FTS input that is passed directly
 * into `websearch_to_tsquery()`.  Bounding it to 500 chars prevents excessively
 * long queries that could cause expensive query plans.
 */
export const searchWorkersQuerySchema = z.object({
  q:     z.string().max(500).optional(),
  query: z.string().max(500).optional(),
  lang:  z
    .string()
    .regex(/^(simple|english|french|german|spanish|portuguese|italian|dutch|russian|arabic)$/i)
    .optional(),
  lat:       z.coerce.number().min(-90).max(90).optional(),
  lng:       z.coerce.number().min(-180).max(180).optional(),
  radius:    z.coerce.number().min(0.1).max(1000).optional(),
  categories: z.string().max(500).optional(),
  minRating: z.coerce.number().min(1).max(5).optional(),
  maxRating: z.coerce.number().min(1).max(5).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
  isVerified: z.coerce.boolean().optional(),
  sortBy:    z.enum(['relevance', 'rating', 'distance', 'newest']).optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
})
