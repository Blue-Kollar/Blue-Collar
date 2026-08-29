import { z } from 'zod'
import { registry } from '../registry.js'

registry.registerPath({
  method: 'post', path: '/api/vitals', tags: ['System'],
  summary: 'Report a Web Vitals measurement from the client (public, fire-and-forget)',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string(),
            value: z.number(),
            rating: z.string().optional(),
            id: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: { 204: { description: 'Accepted, no content' } },
})
