import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FeaturedWorkersSkeleton } from '@/features/landing-page/FeaturedWorkers';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ alt, src, ...props }: any) => <img alt={alt} src={src} {...props} />,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(' ')}` : key,
}));

describe('FeaturedWorkers Section', () => {
  describe('Skeleton Loading State', () => {
    it('renders skeleton loading UI', () => {
      render(<FeaturedWorkersSkeleton />);
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    });

    it('renders skeleton cards', () => {
      const { container } = render(<FeaturedWorkersSkeleton />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders six skeleton cards in grid', () => {
      const { container } = render(<FeaturedWorkersSkeleton />);
      const gridItems = container.querySelectorAll('.rounded-xl.border');
      expect(gridItems.length).toBe(6);
    });

    it('has correct grid layout classes', () => {
      const { container } = render(<FeaturedWorkersSkeleton />);
      const grid = container.querySelector('.lg\\:grid-cols-3');
      expect(grid).toBeInTheDocument();
    });

    it('renders as independent section', () => {
      const { container } = render(<FeaturedWorkersSkeleton />);
      expect(container.querySelector('section')).toBeInTheDocument();
    });

    it('contains responsive grid structure', () => {
      const { container } = render(<FeaturedWorkersSkeleton />);
      const gridContainer = container.querySelector('.sm\\:grid-cols-2');
      expect(gridContainer).toBeInTheDocument();
    });
  });
});
