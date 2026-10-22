import { fireEvent, screen } from '@testing-library/react'
import { renderWithIntl as render } from '@/__tests__/renderWithIntl'
import { describe, expect, it, vi } from 'vitest'
import { SavedWorkers } from '../SavedWorkers'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

vi.mock('next/image', () => ({
  default: ({ src, alt }: any) => <img src={src} alt={alt} />,
}))

vi.mock('lucide-react', () => ({
  Bookmark: () => <span />,
  Star: () => <span />,
}))

vi.mock('@/components/Skeleton', () => ({
  WorkerCardSkeleton: () => <div data-testid="worker-skeleton" />,
}))

const workers = [
  {
    id: 'w1',
    name: 'Jane Doe',
    avatar: 'https://example.com/jane.jpg',
    category: { id: 'c1', name: 'Plumber' },
    averageRating: 4.5,
    location: 'Lagos',
  },
  {
    id: 'w2',
    name: 'John Smith',
    avatar: null,
    category: { id: 'c2', name: 'Electrician' },
    averageRating: null,
    location: null,
  },
]

describe('SavedWorkers', () => {
  it('renders a skeleton grid while loading', () => {
    render(<SavedWorkers workers={[]} loading />)

    expect(screen.getByLabelText('Loading saved workers')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getAllByTestId('worker-skeleton')).toHaveLength(4)
  })

  it('renders the empty state with a browse link', () => {
    render(<SavedWorkers workers={[]} />)

    expect(screen.getByText('No saved workers yet.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Browse workers' })).toHaveAttribute('href', '/workers')
  })

  it('renders saved worker details and links to each profile', () => {
    render(<SavedWorkers workers={workers} />)

    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Plumber')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Jane Doe' })).toHaveAttribute(
      'src',
      'https://example.com/jane.jpg',
    )
    expect(screen.getByRole('link', { name: 'Jane Doe' })).toHaveAttribute('href', '/workers/w1')
    expect(screen.getByRole('link', { name: 'John Smith' })).toHaveAttribute('href', '/workers/w2')
  })

  it('shows the initial as an avatar fallback and hides missing ratings', () => {
    render(<SavedWorkers workers={[workers[1]!]} />)

    expect(screen.getByText('J')).toBeInTheDocument()
    expect(screen.queryByText('0.0')).not.toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('calls onRemove with the worker id', () => {
    const onRemove = vi.fn()
    render(<SavedWorkers workers={workers} onRemove={onRemove} />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Jane Doe from saved' }))

    expect(onRemove).toHaveBeenCalledOnce()
    expect(onRemove).toHaveBeenCalledWith('w1')
  })

  it('hides remove controls when no handler is provided', () => {
    render(<SavedWorkers workers={workers} />)

    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
