import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

extendZodWithOpenApi(z)

export const registry = new OpenAPIRegistry()

// ── Reusable schemas ──────────────────────────────────────────────────────────
export const BearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http', scheme: 'bearer', bearerFormat: 'JWT',
})

export const ErrorSchema = registry.register('Error', z.object({
  status: z.literal('error'),
  message: z.string(),
  code: z.number(),
}))

export const SuccessSchema = registry.register('Success', z.object({
  status: z.literal('success'),
  message: z.string(),
  code: z.number(),
}))

export const CategorySchema = registry.register('Category', z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
}))

export const WorkerSchema = registry.register('Worker', z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  bio: z.string().nullable(),
  isActive: z.boolean(),
  walletAddress: z.string().nullable(),
  avgRating: z.number(),
  reviewCount: z.number(),
  categoryId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}))

export const UserSchema = registry.register('User', z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['user', 'curator', 'admin']),
  verified: z.boolean(),
})
)

export const TokenResponseSchema = registry.register('TokenResponse', z.object({
  status: z.literal('success'),
  message: z.string(),
  code: z.number(),
  token: z.string(),
  data: UserSchema,
}))

export const PaginatedWorkersSchema = registry.register('PaginatedWorkers', z.object({
  status: z.literal('success'),
  data: z.array(WorkerSchema),
  meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }),
}))
