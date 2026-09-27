import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Hero from '@/features/landing-page/Hero';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(' ')}` : key,
  useLocale: () => 'en',
  useMessages: () => ({}),
}));

vi.mock('lucide-react', () => ({
  ArrowRight: () => <span data-testid="arrow-icon" />,
}));

describe('Hero Section', () => {
  it('renders hero section correctly', () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('renders search form with category and location inputs', () => {
    render(<Hero />);
    const categoryInput = screen.getByPlaceholderText('categoryPlaceholder');
    const locationInput = screen.getByPlaceholderText('locationPlaceholder');
    expect(categoryInput).toBeInTheDocument();
    expect(locationInput).toBeInTheDocument();
  });

  it('renders action buttons', () => {
    render(<Hero />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('renders with correct aria labels', () => {
    render(<Hero />);
    expect(screen.getByLabelText('ariaCategory')).toBeInTheDocument();
    expect(screen.getByLabelText('ariaLocation')).toBeInTheDocument();
  });

  it('has independent state management', () => {
    const { rerender } = render(<Hero />);
    const categoryInput = screen.getByPlaceholderText('categoryPlaceholder') as HTMLInputElement;
    expect(categoryInput.value).toBe('');
    rerender(<Hero />);
    expect(screen.getByPlaceholderText('categoryPlaceholder')).toBeInTheDocument();
  });

  it('renders submit button', () => {
    render(<Hero />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
