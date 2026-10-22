import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HowItWorks from '@/features/landing-page/HowItWorks';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(' ')}` : key,
  useLocale: () => 'en',
  useMessages: () => ({}),
}));

const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver as any;

describe('HowItWorks Section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders how it works section correctly', () => {
    render(<HowItWorks />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('renders three steps with icons', () => {
    render(<HowItWorks />);
    expect(screen.getByText('🔍')).toBeInTheDocument();
    expect(screen.getByText('✅')).toBeInTheDocument();
    expect(screen.getByText('⛓️')).toBeInTheDocument();
  });

  it('renders step titles', () => {
    render(<HowItWorks />);
    expect(screen.getByRole('heading', { level: 3, name: /step1Title/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /step2Title/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /step3Title/ })).toBeInTheDocument();
  });

  it('renders step descriptions', () => {
    render(<HowItWorks />);
    expect(screen.getByText(/step1Desc/)).toBeInTheDocument();
    expect(screen.getByText(/step2Desc/)).toBeInTheDocument();
    expect(screen.getByText(/step3Desc/)).toBeInTheDocument();
  });

  it('renders as independent section', () => {
    const { container } = render(<HowItWorks />);
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('has correct grid layout structure', () => {
    const { container } = render(<HowItWorks />);
    const grid = container.querySelector('.sm\\:grid-cols-3');
    expect(grid).toBeInTheDocument();
  });

  it('renders step components with animation classes', () => {
    const { container } = render(<HowItWorks />);
    const stepDivs = container.querySelectorAll('[style*="transitionDelay"]');
    expect(stepDivs.length).toBeGreaterThan(0);
  });

  it('has no dependencies on other sections', () => {
    const { container } = render(<HowItWorks />);
    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section?.innerHTML.includes('section')).toBe(false);
  });
});
