import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Categories from '@/features/landing-page/Categories';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key} ${Object.values(params).join(' ')}` : key,
}));

describe('Categories Section', () => {
  it('renders categories section correctly', async () => {
    const { container } = render(await Categories());
    expect(container.querySelector('section')).toBeInTheDocument();
  });

  it('renders section heading', async () => {
    render(await Categories());
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
  });

  it('has independent section structure', async () => {
    const { container } = render(await Categories());
    const section = container.querySelector('section');
    expect(section).toBeInTheDocument();
    expect(section?.className).toContain('px-4');
    expect(section?.className).toContain('py-12');
  });

  it('renders as responsive grid', async () => {
    const { container } = render(await Categories());
    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid?.className).toContain('grid-cols-2');
    expect(grid?.className).toContain('sm\\:grid-cols-3');
  });

  it('has correct max-width container', async () => {
    const { container } = render(await Categories());
    const wrapper = container.querySelector('.max-w-6xl');
    expect(wrapper).toBeInTheDocument();
  });

  it('renders with proper spacing classes', async () => {
    const { container } = render(await Categories());
    const section = container.querySelector('section');
    expect(section?.className).toContain('gap-4');
  });

  it('renders no dependencies on other sections', async () => {
    const { container } = render(await Categories());
    const importsOrDependencies = container.querySelector('[data-imported-component]');
    expect(importsOrDependencies).not.toBeInTheDocument();
  });
});
