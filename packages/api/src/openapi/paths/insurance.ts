import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/insurance', tags: ['Insurance'],
  summary: 'Upload an insurance document for a worker (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'multipart/form-data': { schema: z.object({ expiresAt: z.string(), provider: z.string(), policyNumber: z.string(), document: z.string().describe('Insurance document file') }) } } },
  },
  responses: { 201: { description: 'Document uploaded', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/insurance', tags: ['Insurance'],
  summary: 'List insurance documents for a worker (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Insurance documents', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/workers/{id}/insurance/{docId}', tags: ['Insurance'],
  summary: 'Verify or reject an insurance document (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string(), docId: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ status: z.enum(['verified', 'rejected']) }) } } },
  },
  responses: { 200: { description: 'Document status updated', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/insurance/reminders', tags: ['Insurance'],
  summary: 'Manually trigger insurance renewal reminders (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Reminders triggered', content: { 'application/json': { schema: SuccessSchema } } } },
})
