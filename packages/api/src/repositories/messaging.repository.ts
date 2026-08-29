import type { Conversation, ConversationParticipant, Message, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IMessagingRepository extends IRepository<Conversation, Prisma.ConversationCreateInput, Prisma.ConversationUpdateInput> {
  createConversation(data: Prisma.ConversationCreateInput): Promise<Conversation & { participants: ConversationParticipant[] }>
  findConversation(id: string, userId: string): Promise<(Conversation & { participants: ConversationParticipant[]; messages: Message[] }) | null>
  findUserConversations(userId: string, opts: { skip: number; take: number }): Promise<{ data: Conversation[]; total: number }>
  findMessage(id: string): Promise<Message | null>
  updateMessage(id: string, data: Prisma.MessageUpdateInput): Promise<Message>
  updateParticipantReadAt(conversationId: string, userId: string): Promise<ConversationParticipant>
  findConversationsForUnreadCount(userId: string): Promise<Conversation[]>
  searchMessages(conversationId: string, searchQuery: string): Promise<Message[]>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class MessagingRepository implements IMessagingRepository {
  async findById(id: string): Promise<Conversation | null> {
    return db.conversation.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Conversation[]> {
    return db.conversation.findMany({ skip: opts.skip, take: opts.take, orderBy: { updatedAt: 'desc' } })
  }

  async create(data: Prisma.ConversationCreateInput): Promise<Conversation> {
    return db.conversation.create({ data })
  }

  async update(id: string, data: Prisma.ConversationUpdateInput): Promise<Conversation> {
    return db.conversation.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Conversation> {
    return db.conversation.delete({ where: { id } })
  }

  async count(where?: Prisma.ConversationWhereInput): Promise<number> {
    return db.conversation.count({ where })
  }

  async createConversation(data: Prisma.ConversationCreateInput) {
    return db.conversation.create({ data, include: { participants: true } })
  }

  async findConversation(id: string, userId: string) {
    return db.conversation.findFirst({
      where: {
        id,
        participants: { some: { userId } },
      },
      include: {
        participants: {
          include: { user: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
        },
        messages: { take: 50, orderBy: { createdAt: 'asc' } },
      },
    })
  }

  async findUserConversations(userId: string, opts: { skip: number; take: number }) {
    const [data, total] = await Promise.all([
      db.conversation.findMany({
        where: { participants: { some: { userId } } },
        include: {
          participants: true,
          messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { updatedAt: 'desc' },
        skip: opts.skip,
        take: opts.take,
      }),
      db.conversation.count({ where: { participants: { some: { userId } } } }),
    ])
    return { data, total }
  }

  async findMessage(id: string): Promise<Message | null> {
    return db.message.findUnique({ where: { id } })
  }

  async updateMessage(id: string, data: Prisma.MessageUpdateInput): Promise<Message> {
    return db.message.update({ where: { id }, data })
  }

  async updateParticipantReadAt(conversationId: string, userId: string): Promise<ConversationParticipant> {
    return db.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    })
  }

  async findConversationsForUnreadCount(userId: string): Promise<Conversation[]> {
    return db.conversation.findMany({
      where: { participants: { some: { userId } } },
      include: {
        participants: { where: { userId } },
        messages: true,
      },
    })
  }

  async searchMessages(conversationId: string, searchQuery: string): Promise<Message[]> {
    return db.message.findMany({
      where: {
        conversationId,
        body: { search: searchQuery.split(' ').join(' | ') },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }
}

export const messagingRepository = new MessagingRepository()
