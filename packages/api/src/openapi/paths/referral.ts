import { z } from 'zod'
import { registry, BearerAuth, ErrorSchema, SuccessSchema } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/v1/referrals/my/code', tags: ['Referrals'],
  summary: "Get the authenticated user's referral code",
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Referral code', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ code: z.string() }) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/referrals/apply', tags: ['Referrals'],
  summary: 'Apply a referral code to the authenticated user',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ code: z.string() }) } } } },
  responses: {
    200: { description: 'Referral applied', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Invalid or already-used code', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/referrals/my/stats', tags: ['Referrals'],
  summary: "Get the authenticated user's referral stats",
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Referral stats', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/referrals/leaderboard', tags: ['Referrals'],
  summary: 'Get the public referral leaderboard',
  responses: { 200: { description: 'Leaderboard', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/referrals/{id}/reward', tags: ['Referrals'],
  summary: 'Mark a referral as rewarded (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Referral rewarded', content: { 'application/json': { schema: SuccessSchema } } } },
})
