import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

registry.registerPath({
  method: 'post', path: '/api/v1/verifications', tags: ['Verifications'],
  summary: 'Request a verification',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.record(z.unknown()) } } } },
  responses: { 201: { description: 'Verification requested', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/verifications', tags: ['Verifications'],
  summary: 'List pending verification requests (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Verification requests', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/verifications/{id}/review', tags: ['Verifications'],
  summary: 'Approve or reject a verification request (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ action: z.enum(['approve', 'reject']) }) } } } },
  responses: { 200: { description: 'Reviewed', content: { 'application/json': { schema: SuccessSchema } } } },
})
