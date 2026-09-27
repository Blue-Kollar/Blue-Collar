import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/response-stats', tags: ['ResponseTime'],
  summary: 'Get response-time stats for a worker (public)',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Response stats', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/workers/{id}/contacts/{requestId}/respond', tags: ['ResponseTime'],
  summary: 'Respond to a contact request (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string(), requestId: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ status: z.string() }) } } },
  },
  responses: { 200: { description: 'Response recorded', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/analytics/response-times', tags: ['ResponseTime'],
  summary: 'Get platform-wide response-time analytics (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Response time analytics', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})
