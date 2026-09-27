import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { axe, toHaveNoViolations } from 'jest-axe'

expect.extend(toHaveNoViolations)

describe('MessageThread Accessibility', () => {
  const mockMessages = [
    {
      id: '1',
      body: 'Hello there!',
      senderId: 'user-1',
      createdAt: '2026-07-26T10:00:00Z',
      readAt: '2026-07-26T10:01:00Z',
      sender: {
        id: 'user-2',
        name: 'John',
        avatar: 'https://example.com/john.jpg',
      },
    },
    {
      id: '2',
      body: 'Hi! How are you?',
      senderId: 'user-2',
      createdAt: '2026-07-26T10:05:00Z',
      readAt: null,
      sender: {
        id: 'user-2',
        name: 'John',
        avatar: null,
      },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('has no accessibility violations', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    const { container } = render(
      <MessageThread
        messages={mockMessages}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('has proper ARIA labels for the message thread', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={mockMessages}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    expect(screen.getByRole('main', { name: 'Message thread' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Messages' })).toBeInTheDocument()
    expect(screen.getByRole('log', { name: 'Conversation messages' })).toBeInTheDocument()
  })

  it('provides descriptive aria-labels for individual messages', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={mockMessages}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    const messages = screen.getAllByRole('article')
    expect(messages.length).toBeGreaterThan(0)
    expect(messages[0]).toHaveAttribute('aria-label', expect.stringContaining('Message from'))
  })

  it('displays proper status for no conversation selected', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={[]}
        conversationId={null}
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    expect(screen.getByRole('status', { name: 'No conversation selected' })).toBeInTheDocument()
  })

  it('displays proper status for no messages', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={[]}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    expect(screen.getByRole('status', { name: 'No messages' })).toBeInTheDocument()
  })

  it('provides avatar alt text for accessibility', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={mockMessages}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    const images = screen.getAllByRole('img')
    images.forEach((img) => {
      expect(img).toHaveAttribute('alt', expect.anything())
    })
  })

  it('makes message region focusable for keyboard navigation', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={mockMessages}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    const region = screen.getByRole('region', { name: 'Messages' })
    expect(region).toHaveAttribute('tabindex', '0')
  })

  it('supports keyboard navigation to scroll to bottom', async () => {
    const user = userEvent.setup()
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={mockMessages}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    const region = screen.getByRole('region', { name: 'Messages' })
    await user.click(region)
    await user.keyboard('{Control>}{End}{/Control}')

    expect(region).toHaveFocus()
  })

  it('uses aria-live for message updates', async () => {
    const { default: MessageThread } = await import('@/components/MessageThread')
    render(
      <MessageThread
        messages={mockMessages}
        conversationId="conv-1"
        onSend={vi.fn()}
        currentUserId="user-1"
      />,
    )

    const region = screen.getByRole('region', { name: 'Messages' })
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region).toHaveAttribute('aria-atomic', 'false')
  })
})
