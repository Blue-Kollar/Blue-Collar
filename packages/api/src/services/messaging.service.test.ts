import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as messagingService from './messaging.service.js'

// Mock dependencies
vi.mock('../db.js', () => ({
  db: {
    conversation: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    conversationParticipant: {
      update: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { db } from '../db.js'

const mockDb = db as any

// Helper functions
function createMockParticipant(userId: string) {
  return {
    id: `participant-${userId}`,
    conversationId: 'conv-1',
    userId,
    lastReadAt: new Date('2024-01-01'),
    user: {
      id: userId,
      firstName: 'John',
      lastName: 'Doe',
      avatar: 'https://example.com/avatar.jpg',
    },
  }
}

function createMockConversation(overrides = {}) {
  return {
    id: 'conv-1',
    subject: 'Test Conversation',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    participants: [createMockParticipant('user-1'), createMockParticipant('user-2')],
    messages: [
      {
        id: 'msg-1',
        conversationId: 'conv-1',
        senderId: 'user-1',
        body: 'Hello',
        createdAt: new Date('2024-01-02'),
      },
    ],
    ...overrides,
  }
}

function createMockMessage(overrides = {}) {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    body: 'Hello, this is a test message',
    createdAt: new Date('2024-01-02'),
    updatedAt: new Date('2024-01-02'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Messaging Service', () => {
  describe('createConversation', () => {
    it('should create conversation with multiple participants', async () => {
      const mockConv = createMockConversation()

      mockDb.conversation.create.mockResolvedValue(mockConv)

      const result = await messagingService.createConversation(
        ['user-1', 'user-2'],
        'Test Conversation'
      )

      expect(mockDb.conversation.create).toHaveBeenCalledWith({
        data: {
          subject: 'Test Conversation',
          participants: {
            create: [
              { userId: 'user-1' },
              { userId: 'user-2' },
            ],
          },
        },
        include: { participants: true },
      })
      expect(result).toEqual(mockConv)
    })

    it('should create conversation without subject', async () => {
      const mockConv = createMockConversation({ subject: null })

      mockDb.conversation.create.mockResolvedValue(mockConv)

      const result = await messagingService.createConversation(['user-1', 'user-2'])

      expect(mockDb.conversation.create).toHaveBeenCalledWith({
        data: {
          subject: undefined,
          participants: {
            create: [
              { userId: 'user-1' },
              { userId: 'user-2' },
            ],
          },
        },
        include: { participants: true },
      })
      expect(result).toEqual(mockConv)
    })

    it('should create conversation with single participant', async () => {
      const mockConv = createMockConversation({
        participants: [createMockParticipant('user-1')],
      })

      mockDb.conversation.create.mockResolvedValue(mockConv)

      const result = await messagingService.createConversation(['user-1'])

      expect(mockDb.conversation.create).toHaveBeenCalled()
      expect(result).toEqual(mockConv)
    })
  })

  describe('getConversation', () => {
    it('should return conversation with all messages for authorized user', async () => {
      const mockConv = createMockConversation()

      mockDb.conversation.findFirst.mockResolvedValue(mockConv)

      const result = await messagingService.getConversation('conv-1', 'user-1')

      expect(mockDb.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-1',
          participants: { some: { userId: 'user-1' } },
        },
        include: {
          participants: { include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } } },
          messages: { take: 50, orderBy: { createdAt: 'asc' } },
        },
      })
      expect(result).toEqual(mockConv)
    })

    it('should throw error if conversation not found', async () => {
      mockDb.conversation.findFirst.mockResolvedValue(null)

      await expect(
        messagingService.getConversation('invalid-conv', 'user-1')
      ).rejects.toThrow('Conversation not found')
    })

    it('should throw error if user is not participant', async () => {
      mockDb.conversation.findFirst.mockResolvedValue(null)

      await expect(
        messagingService.getConversation('conv-1', 'unauthorized-user')
      ).rejects.toThrow('Conversation not found')
    })

    it('should limit messages to last 50', async () => {
      const mockConv = createMockConversation()

      mockDb.conversation.findFirst.mockResolvedValue(mockConv)

      await messagingService.getConversation('conv-1', 'user-1')

      expect(mockDb.conversation.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            messages: expect.objectContaining({ take: 50 }),
          }),
        })
      )
    })
  })

  describe('getUserConversations', () => {
    it('should return paginated conversations for user', async () => {
      const mockConvs = [
        createMockConversation({ id: 'conv-1' }),
        createMockConversation({ id: 'conv-2' }),
      ]

      mockDb.conversation.findMany.mockResolvedValue(mockConvs)
      mockDb.conversation.count.mockResolvedValue(10)

      const result = await messagingService.getUserConversations('user-1', 1, 20)

      expect(mockDb.conversation.findMany).toHaveBeenCalledWith({
        where: { participants: { some: { userId: 'user-1' } } },
        include: {
          participants: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 20,
      })
      expect(result.data).toEqual(mockConvs)
      expect(result.meta.total).toBe(10)
      expect(result.meta.page).toBe(1)
      expect(result.meta.limit).toBe(20)
      expect(result.meta.pages).toBe(1)
    })

    it('should use default pagination values', async () => {
      mockDb.conversation.findMany.mockResolvedValue([])
      mockDb.conversation.count.mockResolvedValue(0)

      const result = await messagingService.getUserConversations('user-1')

      expect(mockDb.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 20,
        })
      )
      expect(result.meta.limit).toBe(20)
      expect(result.meta.page).toBe(1)
    })

    it('should calculate correct pagination offset', async () => {
      mockDb.conversation.findMany.mockResolvedValue([])
      mockDb.conversation.count.mockResolvedValue(100)

      await messagingService.getUserConversations('user-1', 3, 10)

      expect(mockDb.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        })
      )
    })

    it('should calculate total pages correctly', async () => {
      mockDb.conversation.findMany.mockResolvedValue([])
      mockDb.conversation.count.mockResolvedValue(55)

      const result = await messagingService.getUserConversations('user-1', 1, 10)

      expect(result.meta.pages).toBe(6)
    })
  })

  describe('searchMessages', () => {
    it('should search messages in conversation', async () => {
      const mockConv = createMockConversation()
      const mockMessages = [
        createMockMessage({ body: 'test message' }),
        createMockMessage({ body: 'another test' }),
      ]

      mockDb.conversation.findFirst.mockResolvedValue(mockConv)
      mockDb.message.findMany.mockResolvedValue(mockMessages)

      const result = await messagingService.searchMessages('conv-1', 'test', 'user-1')

      expect(mockDb.conversation.findFirst).toHaveBeenCalledWith({
        where: {
          id: 'conv-1',
          participants: { some: { userId: 'user-1' } },
        },
      })
      expect(mockDb.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-1',
          body: { search: 'test' },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      expect(result).toEqual(mockMessages)
    })

    it('should throw error if conversation not found', async () => {
      mockDb.conversation.findFirst.mockResolvedValue(null)

      await expect(
        messagingService.searchMessages('invalid-conv', 'test', 'user-1')
      ).rejects.toThrow('Conversation not found')
    })

    it('should handle multi-word search queries', async () => {
      const mockConv = createMockConversation()

      mockDb.conversation.findFirst.mockResolvedValue(mockConv)
      mockDb.message.findMany.mockResolvedValue([])

      await messagingService.searchMessages('conv-1', 'hello world', 'user-1')

      expect(mockDb.message.findMany).toHaveBeenCalledWith({
        where: {
          conversationId: 'conv-1',
          body: { search: 'hello | world' },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    })
  })

  describe('deleteMessage', () => {
    it('should soft delete message for authorized user', async () => {
      const mockMsg = createMockMessage({ senderId: 'user-1' })
      const deletedMsg = createMockMessage({ senderId: 'user-1', body: '[deleted]' })

      mockDb.message.findUnique.mockResolvedValue(mockMsg)
      mockDb.message.update.mockResolvedValue(deletedMsg)

      const result = await messagingService.deleteMessage('msg-1', 'user-1')

      expect(mockDb.message.findUnique).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
      })
      expect(mockDb.message.update).toHaveBeenCalledWith({
        where: { id: 'msg-1' },
        data: { body: '[deleted]' },
      })
      expect(result.body).toBe('[deleted]')
    })

    it('should throw error if message not found', async () => {
      mockDb.message.findUnique.mockResolvedValue(null)

      await expect(
        messagingService.deleteMessage('invalid-msg', 'user-1')
      ).rejects.toThrow('Message not found')
    })

    it('should throw error if user is not sender', async () => {
      const mockMsg = createMockMessage({ senderId: 'user-2' })

      mockDb.message.findUnique.mockResolvedValue(mockMsg)

      await expect(
        messagingService.deleteMessage('msg-1', 'user-1')
      ).rejects.toThrow('Unauthorized')
    })
  })

  describe('markConversationAsRead', () => {
    it('should update last read timestamp', async () => {
      const now = new Date()
      const updatedParticipant = {
        conversationId: 'conv-1',
        userId: 'user-1',
        lastReadAt: now,
      }

      mockDb.conversationParticipant.update.mockResolvedValue(updatedParticipant)

      const result = await messagingService.markConversationAsRead('conv-1', 'user-1')

      expect(mockDb.conversationParticipant.update).toHaveBeenCalledWith({
        where: { conversationId_userId: { conversationId: 'conv-1', userId: 'user-1' } },
        data: { lastReadAt: expect.any(Date) },
      })
      expect(result.lastReadAt).toBeDefined()
    })
  })

  describe('getUnreadCount', () => {
    it('should return zero unread messages when all are read', async () => {
      const now = new Date()
      const mockConvs = [
        {
          id: 'conv-1',
          participants: [
            {
              userId: 'user-1',
              lastReadAt: now,
            },
          ],
          messages: [
            {
              id: 'msg-1',
              createdAt: new Date(now.getTime() - 1000), // before lastReadAt
            },
          ],
        },
      ]

      mockDb.conversation.findMany.mockResolvedValue(mockConvs)

      const result = await messagingService.getUnreadCount('user-1')

      expect(result).toBe(0)
    })

    it('should count unread messages created after last read', async () => {
      const lastReadAt = new Date('2024-01-01')
      const mockConvs = [
        {
          id: 'conv-1',
          participants: [
            {
              userId: 'user-1',
              lastReadAt,
            },
          ],
          messages: [
            {
              id: 'msg-1',
              createdAt: new Date('2024-01-02'), // after lastReadAt
            },
            {
              id: 'msg-2',
              createdAt: new Date('2024-01-03'), // after lastReadAt
            },
            {
              id: 'msg-3',
              createdAt: new Date('2023-12-31'), // before lastReadAt
            },
          ],
        },
      ]

      mockDb.conversation.findMany.mockResolvedValue(mockConvs)

      const result = await messagingService.getUnreadCount('user-1')

      expect(result).toBe(2)
    })

    it('should count unread messages when no last read timestamp', async () => {
      const mockConvs = [
        {
          id: 'conv-1',
          participants: [
            {
              userId: 'user-1',
              lastReadAt: null,
            },
          ],
          messages: [
            { id: 'msg-1', createdAt: new Date() },
            { id: 'msg-2', createdAt: new Date() },
          ],
        },
      ]

      mockDb.conversation.findMany.mockResolvedValue(mockConvs)

      const result = await messagingService.getUnreadCount('user-1')

      expect(result).toBe(2)
    })

    it('should sum unread counts across multiple conversations', async () => {
      const mockConvs = [
        {
          id: 'conv-1',
          participants: [{ userId: 'user-1', lastReadAt: new Date('2024-01-01') }],
          messages: [
            { id: 'msg-1', createdAt: new Date('2024-01-02') },
            { id: 'msg-2', createdAt: new Date('2024-01-03') },
          ],
        },
        {
          id: 'conv-2',
          participants: [{ userId: 'user-1', lastReadAt: new Date('2024-01-01') }],
          messages: [
            { id: 'msg-3', createdAt: new Date('2024-01-02') },
          ],
        },
      ]

      mockDb.conversation.findMany.mockResolvedValue(mockConvs)

      const result = await messagingService.getUnreadCount('user-1')

      expect(result).toBe(3)
    })
  })
})
