import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/v1/auth/devices', tags: ['Devices'],
  summary: 'List active devices/sessions for the authenticated user',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Devices', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/auth/devices/{deviceId}', tags: ['Devices'],
  summary: 'Revoke a specific device/session',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ deviceId: z.string() }) },
  responses: { 200: { description: 'Device revoked', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/devices/revoke-others', tags: ['Devices'],
  summary: 'Revoke all other active devices (log out other sessions)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ currentDeviceId: z.string().min(1) }) } } } },
  responses: { 200: { description: 'Other devices revoked', content: { 'application/json': { schema: SuccessSchema } } } },
})
