import { z } from 'zod'
import { registry, BearerAuth, ErrorSchema } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/v1/audit', tags: ['Audit'],
  summary: 'Query audit log entries (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    query: z.object({
      userId: z.string().optional(),
      action: z.string().optional(),
      resource: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      page: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: { description: 'Audit log entries', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())), meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }) }) } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorSchema } } },
  },
})
