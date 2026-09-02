import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import WorkerCard from '@/components/WorkerCard'
import type { Worker } from '@/types'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

// lucide-react icons aren't critical to test — stub them out
vi.mock('lucide-react', () => ({
  BadgeCheck: ({ 'aria-label': label }: any) => <span aria-label={label} />,
  MapPin: () => <span />,
}))

const baseWorker: Worker = {
  id: 'w1',
  name: 'Jane Doe',
  isVerified: false,
  category: { id: 'c1', name: 'Plumber' },
}

describe('WorkerCard', () => {
  it('renders worker name and category', () => {
    render(<WorkerCard worker={baseWorker} />)
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Plumber')).toBeInTheDocument()
  })

  it('links to /workers/:id', () => {
    render(<WorkerCard worker={baseWorker} />)
    expect(screen.getByRole('link')).toHaveAttribute('href', '/workers/w1')
  })

  it('shows initials when no avatar', () => {
    render(<WorkerCard worker={baseWorker} />)
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('shows img when avatar is provided', () => {
    render(<WorkerCard worker={{ ...baseWorker, avatar: 'https://example.com/avatar.jpg' }} />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/avatar.jpg')
  })

  it('shows verified badge when isVerified is true', () => {
    render(<WorkerCard worker={{ ...baseWorker, isVerified: true }} />)
    expect(screen.getByLabelText('Verified')).toBeInTheDocument()
  })

  it('does not show verified badge when isVerified is false', () => {
    render(<WorkerCard worker={baseWorker} />)
    expect(screen.queryByLabelText('Verified')).not.toBeInTheDocument()
  })

  it('shows bio when present', () => {
    render(<WorkerCard worker={{ ...baseWorker, bio: 'Expert plumber with 10 years experience' }} />)
    expect(screen.getByText('Expert plumber with 10 years experience')).toBeInTheDocument()
  })

  it('shows location when present', () => {
    render(<WorkerCard worker={{ ...baseWorker, location: 'Lagos, Nigeria' }} />)
    expect(screen.getByText('Lagos, Nigeria')).toBeInTheDocument()
  })
})
