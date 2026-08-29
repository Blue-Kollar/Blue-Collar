import { z } from 'zod'
import { registry, BearerAuth } from '../registry.js'

registry.registerPath({
  method: 'post', path: '/api/analytics/events', tags: ['Analytics'],
  summary: 'Record client analytics events (public)',
  request: { body: { content: { 'application/json': { schema: z.object({ events: z.array(z.record(z.unknown())) }) } } } },
  responses: { 202: { description: 'Events accepted' } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/curator', tags: ['Analytics'],
  summary: 'Get curator dashboard analytics (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Curator dashboard data', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/export/curator', tags: ['Analytics'],
  summary: 'Export curator analytics as CSV (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'CSV export (text/csv)' } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/platform', tags: ['Analytics'],
  summary: 'Get platform-wide dashboard analytics (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Platform dashboard data', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/export/platform', tags: ['Analytics'],
  summary: 'Export platform analytics as CSV (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'CSV export (text/csv)' } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/admin/dashboard', tags: ['Analytics'],
  summary: 'Get admin dashboard analytics for a date range (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ startDate: z.string().optional(), endDate: z.string().optional() }) },
  responses: { 200: { description: 'Admin dashboard data', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/admin/export', tags: ['Analytics'],
  summary: 'Export admin analytics as CSV for a date range (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ startDate: z.string().optional(), endDate: z.string().optional() }) },
  responses: { 200: { description: 'CSV export (text/csv)' } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/metrics', tags: ['Analytics'],
  summary: 'Get protocol health metrics',
  responses: { 200: { description: 'Protocol metrics', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/metrics/timeseries', tags: ['Analytics'],
  summary: 'Get protocol health metrics as a time series',
  request: { query: z.object({ days: z.string().optional() }) },
  responses: { 200: { description: 'Time series metrics', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/analytics/top-workers', tags: ['Analytics'],
  summary: 'Get top workers leaderboard by a metric',
  request: { query: z.object({ metric: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: 'Top workers', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})
