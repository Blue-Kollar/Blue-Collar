import { messagingRepository as defaultMessagingRepository } from '../repositories/messaging.repository.js'
import { AppError, ErrorCode } from '../utils/AppError.js'
import type { MessagingServiceDeps } from '../container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createMessagingService(deps: MessagingServiceDeps) {
  const { messagingRepository: repo } = deps

  return {
    async createConversation(participantIds: string[], subject?: string) {
      return repo.createConversation({
        subject,
        participants: {
          create: participantIds.map(id => ({ userId: id })),
        },
      } as any)
    },

    async getConversation(conversationId: string, userId: string) {
      const conversation = await repo.findConversation(conversationId, userId)
      if (!conversation) throw new AppError('Conversation not found', 404, true, ErrorCode.NOT_FOUND)
      return conversation
    },

    async getUserConversations(userId: string, page = 1, limit = 20) {
      const skip = (page - 1) * limit
      const { data, total } = await repo.findUserConversations(userId, { skip, take: limit })
      return {
        data,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      }
    },

    async searchMessages(conversationId: string, query: string, userId: string) {
      const conversation = await repo.findConversation(conversationId, userId)
      if (!conversation) throw new AppError('Conversation not found', 404, true, ErrorCode.NOT_FOUND)

      return repo.searchMessages(conversationId, query)
    },

    async deleteMessage(messageId: string, userId: string) {
      const message = await repo.findMessage(messageId)
      if (!message) throw new AppError('Message not found', 404, true, ErrorCode.NOT_FOUND)
      if ((message as any).senderId !== userId) throw new AppError('Unauthorized', 403, true, ErrorCode.FORBIDDEN)

      return repo.updateMessage(messageId, { body: '[deleted]' } as any)
    },

    async markConversationAsRead(conversationId: string, userId: string) {
      return repo.updateParticipantReadAt(conversationId, userId)
    },

    async getUnreadCount(userId: string) {
      const conversations = await repo.findConversationsForUnreadCount(userId)

      return conversations.reduce((count: number, conv: any) => {
        const participant = conv.participants[0]
        if (!participant?.lastReadAt) return count + conv.messages.length
        return count + conv.messages.filter((m: any) => m.createdAt > participant.lastReadAt).length
      }, 0)
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createMessagingService({
  messagingRepository: defaultMessagingRepository,
})

export async function createConversation(participantIds: string[], subject?: string) {
  return _defaultService.createConversation(participantIds, subject)
}

export async function getConversation(conversationId: string, userId: string) {
  return _defaultService.getConversation(conversationId, userId)
}

export async function getUserConversations(userId: string, page = 1, limit = 20) {
  return _defaultService.getUserConversations(userId, page, limit)
}

export async function searchMessages(conversationId: string, query: string, userId: string) {
  return _defaultService.searchMessages(conversationId, query, userId)
}

export async function deleteMessage(messageId: string, userId: string) {
  return _defaultService.deleteMessage(messageId, userId)
}

export async function markConversationAsRead(conversationId: string, userId: string) {
  return _defaultService.markConversationAsRead(conversationId, userId)
}

export async function getUnreadCount(userId: string) {
  return _defaultService.getUnreadCount(userId)
}
