import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/v1/recommendations', tags: ['Recommendations'],
  summary: 'Get personalized worker recommendations',
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ limit: z.string().optional() }) },
  responses: { 200: { description: 'Recommendations', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/recommendations/interactions', tags: ['Recommendations'],
  summary: 'Track an interaction with a recommended worker',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ workerId: z.string(), type: z.string() }) } } } },
  responses: { 200: { description: 'Interaction recorded', content: { 'application/json': { schema: SuccessSchema } } } },
})
