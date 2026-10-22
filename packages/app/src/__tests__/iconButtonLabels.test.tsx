import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import messages from '@/messages/en.json'
import { IconButton } from '@/components/IconButton'
import BookmarkButton from '@/components/BookmarkButton'
import NotificationDropdown from '@/components/NotificationDropdown'

// Resolve translations from the real English catalogue, supporting {placeholder} values.
function translate(namespace: keyof typeof messages) {
  return (key: string, values?: Record<string, string | number>) => {
    const template = (messages[namespace] as Record<string, string>)[key]
    return Object.entries(values ?? {}).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, String(value)),
      template ?? '',
    )
  }
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace: keyof typeof messages) => translate(namespace),
}))

const notificationState = vi.hoisted(() => ({
  unreadCount: 0,
  notifications: [] as Array<{ id: string; title: string; message: string; type: string; read: boolean; createdAt: string }>,
}))

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({
    ...notificationState,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

vi.mock('@/hooks/queries', () => ({
  useToggleBookmark: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))

describe('IconButton', () => {
  it('exposes the supplied aria-label as its accessible name', () => {
    render(<IconButton aria-label="Close menu">×</IconButton>)

    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument()
  })
})

describe('BookmarkButton', () => {
  it('names the button for adding a bookmark when not bookmarked', () => {
    render(<BookmarkButton workerId="w1" initialBookmarked={false} />)

    expect(screen.getByRole('button', { name: 'Bookmark worker' })).toBeInTheDocument()
  })

  it('names the button for removing a bookmark when already bookmarked', () => {
    render(<BookmarkButton workerId="w1" initialBookmarked />)

    expect(screen.getByRole('button', { name: 'Remove bookmark' })).toBeInTheDocument()
  })
})

describe('NotificationDropdown', () => {
  it('names the trigger from the translated label when nothing is unread', () => {
    notificationState.unreadCount = 0
    notificationState.notifications = []
    render(<NotificationDropdown />)

    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument()
  })

  it('includes the unread count in the trigger name', () => {
    notificationState.unreadCount = 3
    notificationState.notifications = [
      { id: 'n1', title: 'New review', message: 'Great work', type: 'review', read: false, createdAt: new Date().toISOString() },
    ]
    render(<NotificationDropdown />)

    expect(screen.getByRole('button', { name: 'Notifications, 3 unread' })).toBeInTheDocument()
  })

  it('names the icon-only action buttons once the menu is open', async () => {
    const user = userEvent.setup()
    notificationState.unreadCount = 1
    notificationState.notifications = [
      { id: 'n1', title: 'New review', message: 'Great work', type: 'review', read: false, createdAt: new Date().toISOString() },
    ]
    render(<NotificationDropdown />)

    await user.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }))

    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear all notifications' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as read' })).toBeInTheDocument()
  })
})
