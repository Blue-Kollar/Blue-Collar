import { z } from 'zod'
import { registry, BearerAuth, ErrorSchema, SuccessSchema } from '../registry.js'

const EscrowSchema = registry.register('Escrow', z.object({
  id: z.string(),
  jobId: z.string(),
  payeeId: z.string(),
  amountXlm: z.string(),
  status: z.string(),
  createdAt: z.string(),
}))

registry.registerPath({
  method: 'get', path: '/api/escrow', tags: ['Escrow'],
  summary: "List the authenticated user's escrow records",
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ page: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: 'Escrow records', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(EscrowSchema) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/escrow', tags: ['Escrow'],
  summary: 'Create an escrow payment',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ jobId: z.string(), payeeId: z.string(), amountXlm: z.string(), expiresAt: z.string().optional(), txId: z.string() }) } } } },
  responses: { 201: { description: 'Escrow created', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: EscrowSchema }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/escrow/{id}', tags: ['Escrow'],
  summary: 'Get an escrow record',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Escrow record', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: EscrowSchema }) } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'patch', path: '/api/escrow/{id}/activate', tags: ['Escrow'],
  summary: 'Activate an escrow once funded on-chain',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ txId: z.string() }) } } } },
  responses: { 200: { description: 'Escrow activated', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: EscrowSchema }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/escrow/{id}/release', tags: ['Escrow'],
  summary: 'Release escrowed funds to the payee',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Escrow released', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: EscrowSchema }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/escrow/{id}/cancel', tags: ['Escrow'],
  summary: 'Cancel an escrow',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Escrow cancelled', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: EscrowSchema }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/escrow/{id}/disputes', tags: ['Escrow'],
  summary: 'File a dispute against an escrow',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ reason: z.string(), evidence: z.string().optional() }) } } } },
  responses: { 201: { description: 'Dispute filed', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/escrow/{id}/disputes/{disputeId}', tags: ['Escrow'],
  summary: 'Resolve an escrow dispute (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string(), disputeId: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ status: z.string(), resolution: z.string() }) } } },
  },
  responses: { 200: { description: 'Dispute resolved', content: { 'application/json': { schema: SuccessSchema } } } },
})
