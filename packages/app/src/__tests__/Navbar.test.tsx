import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Navbar from '@/components/Navbar'
import type { AuthUser } from '@/context/AuthContext'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
}))

const mockLogout = vi.fn()
const mockConnect = vi.fn()

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/useWallet', () => ({
  useWallet: () => ({
    publicKey: null,
    network: null,
    isConnecting: false,
    connect: mockConnect,
    disconnect: vi.fn(),
  }),
}))

// Return the key, with any interpolated params appended, so assertions can
// match on the dynamic part of a label (e.g. the user's name).
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(' ')}` : key,
  useMessages: () => ({}),
}))

vi.mock('@/context/NotificationContext', () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    clearAll: vi.fn(),
  }),
}))

// Stub every lucide icon as a decorative span via a Proxy, so the list of
// icons Navbar imports can change without breaking this file.
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  const Icon = () => <span aria-hidden="true" />
  const mock: Record<string, unknown> = {}
  for (const key of Object.keys(actual)) {
    mock[key] = typeof (actual as any)[key] === 'function' ? Icon : (actual as any)[key]
  }
  return mock
})

vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme: 'light', setTheme: vi.fn() }),
}))

import { useAuth } from '@/hooks/useAuth'

const setUser = (user: AuthUser | null) => {
  vi.mocked(useAuth).mockReturnValue({
    user,
    logout: mockLogout,
    token: null,
    isAuthenticated: !!user,
    isLoading: false,
    login: vi.fn(),
  })
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Login and Register when logged out', () => {
    setUser(null)
    render(<Navbar />)
    expect(screen.getAllByRole('link', { name: /login/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /register/i })[0]).toBeInTheDocument()
  })

  it('shows user firstName when logged in', () => {
    setUser({ id: '1', firstName: 'Alice', lastName: 'Smith', email: 'a@b.com', role: 'user' })
    render(<Navbar />)
    expect(screen.getByRole('button', { name: /alice/i })).toBeInTheDocument()
  })

  it('shows Logout when logged in', async () => {
    const user = userEvent.setup()
    setUser({ id: '1', firstName: 'Alice', lastName: 'Smith', email: 'a@b.com', role: 'user' })
    render(<Navbar />)
    await user.click(screen.getByRole('button', { name: /alice/i }))
    expect(await screen.findByText('logout')).toBeInTheDocument()
  })

  it('shows Dashboard for curator role', async () => {
    const user = userEvent.setup()
    setUser({ id: '2', firstName: 'Bob', lastName: 'Jones', email: 'b@c.com', role: 'curator' })
    render(<Navbar />)
    await user.click(screen.getByRole('button', { name: /bob/i }))
    expect(await screen.findByText('dashboard')).toBeInTheDocument()
  })

  it('does not show Dashboard for plain user role', async () => {
    const user = userEvent.setup()
    setUser({ id: '3', firstName: 'Carol', lastName: 'Lee', email: 'c@d.com', role: 'user' })
    render(<Navbar />)
    await user.click(screen.getByRole('button', { name: /carol/i }))
    await screen.findByText('logout') // wait for dropdown to open
    expect(screen.queryByText('dashboard')).not.toBeInTheDocument()
  })
})
