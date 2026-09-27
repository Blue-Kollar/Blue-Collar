import { z } from 'zod'
import { registry, BearerAuth, ErrorSchema, SuccessSchema } from '../registry.js'

const WebhookSubscriptionSchema = registry.register('WebhookSubscription', z.object({
  id: z.string(),
  url: z.string(),
  events: z.array(z.string()),
  createdAt: z.string(),
}))

registry.registerPath({
  method: 'post', path: '/api/v1/webhooks', tags: ['Webhooks'],
  summary: 'Create a webhook subscription',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ url: z.string().url(), events: z.array(z.string()) }) } } } },
  responses: {
    201: { description: 'Subscription created', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: WebhookSubscriptionSchema }) } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/webhooks', tags: ['Webhooks'],
  summary: 'List webhook subscriptions for the authenticated user',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Subscriptions', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(WebhookSubscriptionSchema) }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/webhooks/{id}', tags: ['Webhooks'],
  summary: 'Delete a webhook subscription',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/webhooks/{id}/logs', tags: ['Webhooks'],
  summary: 'Get delivery logs for a webhook subscription',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    query: z.object({ page: z.string().optional(), limit: z.string().optional() }),
  },
  responses: { 200: { description: 'Delivery logs', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})
