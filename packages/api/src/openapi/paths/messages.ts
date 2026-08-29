import { z } from 'zod'
import { registry, BearerAuth, ErrorSchema, SuccessSchema } from '../registry.js'

const ConversationSchema = registry.register('Conversation', z.object({
  id: z.string(),
  participantIds: z.array(z.string()),
  subject: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}))

registry.registerPath({
  method: 'get', path: '/api/messages', tags: ['Messages'],
  summary: "List the authenticated user's conversations",
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ page: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: 'Conversations', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(ConversationSchema) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/messages', tags: ['Messages'],
  summary: 'Create a new conversation',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ participantIds: z.array(z.string()), subject: z.string().optional() }) } } } },
  responses: { 201: { description: 'Conversation created', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: ConversationSchema }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/messages/unread', tags: ['Messages'],
  summary: 'Get the unread message count',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Unread count', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ count: z.number() }) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/messages/{conversationId}', tags: ['Messages'],
  summary: 'Get a conversation with its messages',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ conversationId: z.string() }) },
  responses: {
    200: { description: 'Conversation', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'put', path: '/api/messages/{conversationId}/read', tags: ['Messages'],
  summary: 'Mark a conversation as read',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ conversationId: z.string() }) },
  responses: { 200: { description: 'Marked as read', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/messages/{conversationId}/search', tags: ['Messages'],
  summary: 'Search messages within a conversation',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ conversationId: z.string() }), query: z.object({ q: z.string() }) },
  responses: { 200: { description: 'Matching messages', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/messages/{messageId}', tags: ['Messages'],
  summary: 'Delete a message',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ messageId: z.string() }) },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})
