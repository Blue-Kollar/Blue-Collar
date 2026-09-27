import { z } from 'zod'
import { registry } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/events', tags: ['Indexer'],
  summary: 'Query indexed on-chain events',
  request: {
    query: z.object({
      contractId: z.string().optional(),
      eventName: z.string().optional(),
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: { 200: { description: 'Indexed events', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/events/worker-registrations/{contractId}/{ownerAddress}', tags: ['Indexer'],
  summary: 'Get indexed worker registration events for an owner address',
  request: { params: z.object({ contractId: z.string(), ownerAddress: z.string() }) },
  responses: { 200: { description: 'Worker registration events', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/events/cursor/{contractId}', tags: ['Indexer'],
  summary: 'Get the current indexing cursor for a contract',
  request: { params: z.object({ contractId: z.string() }) },
  responses: { 200: { description: 'Indexing cursor', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})
