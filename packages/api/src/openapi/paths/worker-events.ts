import { registry } from '../registry.js'

registry.registerPath({
  method: 'get', path: '/api/workers/events', tags: ['Realtime'],
  summary: 'Subscribe to live worker status changes via Server-Sent Events',
  description: 'Long-lived `text/event-stream` connection. Emits a `workerStatus` event `{ workerId, isActive, ts }` whenever a worker is toggled, plus periodic `: heartbeat` comments every 25s.',
  responses: {
    200: { description: 'SSE stream of worker status events', content: { 'text/event-stream': { schema: { type: 'string' } } } },
  },
})
