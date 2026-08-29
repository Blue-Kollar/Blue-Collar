import { z } from 'zod'
import { registry, BearerAuth } from '../registry.js'

const NotificationPreferencesSchema = registry.register('NotificationPreferences', z.object({
  newWorkerNearby: z.boolean(),
  statusChange: z.boolean(),
  reviewReply: z.boolean(),
  announcements: z.boolean(),
}))

registry.registerPath({
  method: 'get', path: '/api/notifications/preferences', tags: ['Notifications'],
  summary: "Get the authenticated user's notification preferences",
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Notification preferences', content: { 'application/json': { schema: NotificationPreferencesSchema } } } },
})

registry.registerPath({
  method: 'put', path: '/api/notifications/preferences', tags: ['Notifications'],
  summary: "Update the authenticated user's notification preferences",
  security: [{ [BearerAuth.name]: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            newWorkerNearby: z.boolean().optional(),
            statusChange: z.boolean().optional(),
            reviewReply: z.boolean().optional(),
            announcements: z.boolean().optional(),
          }),
        },
      },
    },
  },
  responses: { 200: { description: 'Preferences updated', content: { 'application/json': { schema: NotificationPreferencesSchema } } } },
})
