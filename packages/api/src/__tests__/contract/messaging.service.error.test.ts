/**
 * Unit tests for messaging service error contracts.
 * Verifies that error paths throw AppError with the correct statusCode and errorCode.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AppError, ErrorCode } from '../../utils/AppError.js'

// Mock the db module before importing the service
vi.mock('../../db.js', () => ({
  db: {
    conversation: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    message: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    conversationParticipant: {
      update: vi.fn(),
    },
  },
}))

import * as messagingService from '../../services/messaging.service.js'
import { db } from '../../db.js'

beforeEach(() => vi.clearAllMocks())

// ── getConversation ───────────────────────────────────────────────────────────

describe('messagingService.getConversation', () => {
  it('throws 404 NOT_FOUND when conversation does not exist or user is not a participant', async () => {
    vi.mocked(db.conversation.findFirst).mockResolvedValue(null)

    await expect(messagingService.getConversation('conv-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ErrorCode.NOT_FOUND,
    })
    await expect(messagingService.getConversation('conv-1', 'user-1')).rejects.toBeInstanceOf(AppError)
  })
})

// ── searchMessages ────────────────────────────────────────────────────────────

describe('messagingService.searchMessages', () => {
  it('throws 404 NOT_FOUND when conversation does not exist or user is not a participant', async () => {
    vi.mocked(db.conversation.findFirst).mockResolvedValue(null)

    await expect(messagingService.searchMessages('conv-1', 'faucet', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ErrorCode.NOT_FOUND,
    })
  })
})

// ── deleteMessage ─────────────────────────────────────────────────────────────

describe('messagingService.deleteMessage', () => {
  it('throws 404 NOT_FOUND when message does not exist', async () => {
    vi.mocked(db.message.findUnique).mockResolvedValue(null)

    await expect(messagingService.deleteMessage('msg-1', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      errorCode: ErrorCode.NOT_FOUND,
    })
  })

  it('throws 403 FORBIDDEN when user is not the message author', async () => {
    vi.mocked(db.message.findUnique).mockResolvedValue({
      id: 'msg-1',
      senderId: 'other-user',
      body: 'hello',
    } as any)

    await expect(messagingService.deleteMessage('msg-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      errorCode: ErrorCode.FORBIDDEN,
    })
  })

  it('soft-deletes the message when the author deletes it', async () => {
    const mockMessage = { id: 'msg-1', senderId: 'user-1', body: 'hello' }
    vi.mocked(db.message.findUnique).mockResolvedValue(mockMessage as any)
    vi.mocked(db.message.update).mockResolvedValue({ ...mockMessage, body: '[deleted]' } as any)

    const result = await messagingService.deleteMessage('msg-1', 'user-1')
    expect(result.body).toBe('[deleted]')
    expect(db.message.update).toHaveBeenCalledWith({
      where: { id: 'msg-1' },
      data: { body: '[deleted]' },
    })
  })
})
