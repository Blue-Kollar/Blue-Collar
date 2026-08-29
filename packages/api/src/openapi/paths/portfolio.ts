import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

const PortfolioItemSchema = registry.register('PortfolioItem', z.object({
  id: z.string(),
  workerId: z.string(),
  imageUrl: z.string(),
  description: z.string().nullable(),
  order: z.number(),
}))

registry.registerPath({
  method: 'get', path: '/api/workers/{workerId}/portfolio', tags: ['Portfolio'],
  summary: "List a worker's portfolio items (public)",
  request: { params: z.object({ workerId: z.string() }) },
  responses: { 200: { description: 'Portfolio items', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(PortfolioItemSchema) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/workers/{workerId}/portfolio', tags: ['Portfolio'],
  summary: 'Add a portfolio item (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ workerId: z.string() }),
    body: { content: { 'multipart/form-data': { schema: z.object({ description: z.string().optional(), order: z.number().optional(), image: z.string().describe('Image file') }) } } },
  },
  responses: { 201: { description: 'Portfolio item added', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: PortfolioItemSchema }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/workers/{workerId}/portfolio/{id}', tags: ['Portfolio'],
  summary: 'Update a portfolio item (curator/admin). Method-spoofed PUT via X-HTTP-Method-Override for file uploads.',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ workerId: z.string(), id: z.string() }),
    body: { content: { 'multipart/form-data': { schema: z.object({ description: z.string().optional(), order: z.number().optional(), image: z.string().describe('Image file').optional() }) } } },
  },
  responses: { 200: { description: 'Portfolio item updated', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: PortfolioItemSchema }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/workers/{workerId}/portfolio/{id}', tags: ['Portfolio'],
  summary: 'Delete a portfolio item (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ workerId: z.string(), id: z.string() }) },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/workers/{workerId}/portfolio/reorder', tags: ['Portfolio'],
  summary: 'Reorder portfolio items (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ workerId: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ items: z.array(z.object({ id: z.string(), order: z.number() })) }) } } },
  },
  responses: { 200: { description: 'Reordered', content: { 'application/json': { schema: SuccessSchema } } } },
})
