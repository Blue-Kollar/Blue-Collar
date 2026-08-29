import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

registry.registerPath({
  method: 'post', path: '/api/subscriptions/webhook', tags: ['Subscriptions'],
  summary: 'Stripe webhook receiver (raw body, Stripe-signature verified, no bearer auth)',
  responses: { 200: { description: 'Event processed', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/subscriptions/{workerId}', tags: ['Subscriptions'],
  summary: "Get a worker's subscription (curator/admin)",
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ workerId: z.string() }) },
  responses: { 200: { description: 'Subscription', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/subscriptions/{workerId}', tags: ['Subscriptions'],
  summary: "Create or upgrade a worker's subscription (curator/admin)",
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ workerId: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ tier: z.string(), stripeCustomerId: z.string().optional(), stripeSubId: z.string().optional(), currentPeriodEnd: z.string().optional() }) } } },
  },
  responses: { 200: { description: 'Subscription created/upgraded', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/subscriptions/{workerId}', tags: ['Subscriptions'],
  summary: "Cancel a worker's subscription (curator/admin)",
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ workerId: z.string() }) },
  responses: { 200: { description: 'Subscription cancelled', content: { 'application/json': { schema: SuccessSchema } } } },
})
