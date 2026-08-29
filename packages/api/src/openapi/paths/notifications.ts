import { z } from 'zod'
import { registry, BearerAuth, SuccessSchema } from '../registry.js'

const NotificationSchema = registry.register('Notification', z.object({
  id: z.string(),
  type: z.string(),
  message: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
}))

registry.registerPath({
  method: 'get', path: '/api/v1/notifications', tags: ['Notifications'],
  summary: "List the authenticated user's notifications",
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Notifications', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(NotificationSchema) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/notifications/unread-count', tags: ['Notifications'],
  summary: 'Get the unread notification count',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Unread count', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ count: z.number() }) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/notifications/preferences', tags: ['Notifications'],
  summary: "Get the authenticated user's notification channel preferences",
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Preferences', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'put', path: '/api/v1/notifications/preferences', tags: ['Notifications'],
  summary: "Update the authenticated user's notification channel preferences",
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.record(z.boolean()) } } } },
  responses: { 200: { description: 'Preferences updated', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/notifications/dispatch', tags: ['Notifications'],
  summary: 'Dispatch a multi-channel notification',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.record(z.unknown()) } } } },
  responses: { 200: { description: 'Dispatched', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/notifications/{notificationId}/delivery-log', tags: ['Notifications'],
  summary: 'Get the delivery log for a notification',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ notificationId: z.string() }) },
  responses: { 200: { description: 'Delivery log', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/notifications/{id}/read', tags: ['Notifications'],
  summary: 'Mark a notification as read',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Marked as read', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/notifications/read-all', tags: ['Notifications'],
  summary: 'Mark all notifications as read',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'All marked as read', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/notifications/{id}', tags: ['Notifications'],
  summary: 'Delete a notification',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})
