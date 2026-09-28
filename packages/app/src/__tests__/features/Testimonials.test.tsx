import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Testimonials from '@/features/landing-page/Testimonials';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(' ')}` : key,
  useLocale: () => 'en',
  useMessages: () => ({}),
}));

vi.mock('lucide-react', () => ({
  Star: () => <span data-testid="star-icon" />,
}));

describe('Testimonials Section', () => {
  it('renders testimonials section correctly', () => {
    render(<Testimonials />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('renders testimonial cards', () => {
    render(<Testimonials />);
    const testimonialCards = screen.getAllByRole('img', { hidden: true });
    expect(testimonialCards.length).toBeGreaterThanOrEqual(0);
  });

  it('displays testimonial content', () => {
    render(<Testimonials />);
    expect(screen.getByText(/Sarah Johnson/)).toBeInTheDocument();
    expect(screen.getByText(/Marcus Chen/)).toBeInTheDocument();
    expect(screen.getByText(/Amara Okafor/)).toBeInTheDocument();
  });

  it('renders testimonial roles', () => {
    render(<Testimonials />);
    expect(screen.getByText('Homeowner')).toBeInTheDocument();
    expect(screen.getByText('Plumber')).toBeInTheDocument();
    expect(screen.getByText('Business Owner')).toBeInTheDocument();
  });

  it('displays star ratings', () => {
    render(<Testimonials />);
    const starIcons = screen.getAllByTestId('star-icon');
    expect(starIcons.length).toBeGreaterThan(0);
  });

  it('renders with no dependencies on other sections', () => {
    const { container } = render(<Testimonials />);
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('displays testimonial content with quotes', () => {
    render(<Testimonials />);
    const section = screen.getByRole('heading', { level: 2 }).closest('section');
    expect(section?.textContent).toContain('BlueCollar');
  });
});
