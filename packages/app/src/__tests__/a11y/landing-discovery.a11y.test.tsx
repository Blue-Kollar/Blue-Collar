/**
 * Landing / discovery surfaces — accessibility regression tests (#1878).
 *
 * Covers the client-rendered sections of the home page and the workers
 * discovery view that the Playwright a11y suite exercises on real pages.
 * Each test runs axe via the shared helper and requires zero blocking
 * (serious/critical WCAG 2.1 AA) violations.
 */
import { screen, waitFor } from '@testing-library/react';
import { renderWithIntl as render } from '@/__tests__/renderWithIntl';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { expectNoA11yViolations } from './axe-helper';

// `src/lib/utils` re-exports from @bluecollar/sdk, which is outside this
// package's test scope; stub it with the helpers these components use.
vi.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
  formatStellarAddress: (address: string) => address,
  truncate: (value: string, max: number) => value.slice(0, max),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

vi.mock('@/lib/api', () => ({
  getWorkers: vi.fn().mockResolvedValue({
    data: [
      {
        id: 'w1',
        name: 'Ada Obi',
        isVerified: true,
        isActive: true,
        category: { id: 'c1', name: 'Plumbing' },
        location: 'Lagos',
      },
    ],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }),
  getCategories: vi.fn().mockResolvedValue({ data: [{ id: 'c1', name: 'Plumbing' }] }),
}));

vi.mock('@/hooks/useDebounce', () => ({ useDebounce: (value: string) => value }));

// BookmarkButton pulls in hooks from outside this package's test scope.
vi.mock('@/components/BookmarkButton', () => ({
  default: ({ label }: any) => <button type="button" aria-label={label ?? 'Bookmark'} />,
}));

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const Icon = ({ 'aria-label': label }: any) =>
    label ? <span role="img" aria-label={label} /> : <span aria-hidden="true" />;
  const mock: Record<string, unknown> = {};
  for (const key of Object.keys(actual)) {
    mock[key] = typeof actual[key] === 'function' ? Icon : actual[key];
  }
  return mock;
});

// HowItWorks uses IntersectionObserver, which jsdom does not implement.
beforeEach(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});

describe('Landing page sections — axe (WCAG 2.1 AA)', () => {
  it('hero search form has no blocking violations', async () => {
    const { default: Hero } = await import('@/features/landing-page/Hero');
    const { container } = render(
      <main>
        <Hero />
      </main>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Worker category' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Location' })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('how-it-works section has no blocking violations', async () => {
    const { default: HowItWorks } = await import('@/features/landing-page/HowItWorks');
    const { container } = render(
      <main>
        <HowItWorks />
      </main>,
    );
    await expectNoA11yViolations(container);
  });

  it('testimonials section has no blocking violations', async () => {
    const { default: Testimonials } = await import('@/features/landing-page/Testimonials');
    const { container } = render(
      <main>
        <Testimonials />
      </main>,
    );
    await expectNoA11yViolations(container);
  });

  it('categories skeleton has no blocking violations', async () => {
    const { CategoriesSkeleton } = await import('@/features/landing-page/Categories');
    const { container } = render(
      <main>
        <CategoriesSkeleton />
      </main>,
    );
    await expectNoA11yViolations(container);
  });

  it('featured workers skeleton has no blocking violations', async () => {
    const { FeaturedWorkersSkeleton } = await import('@/features/landing-page/FeaturedWorkers');
    const { container } = render(
      <main>
        <FeaturedWorkersSkeleton />
      </main>,
    );
    await expectNoA11yViolations(container);
  });
});

describe('Workers discovery — axe (WCAG 2.1 AA)', () => {
  it('has no blocking violations with a populated result list', async () => {
    const { default: WorkersDiscovery } = await import('@/components/WorkersDiscovery');
    const { CompareProvider } = await import('@/context/CompareContext');
    const { container } = render(
      <main>
        <CompareProvider>
          <WorkersDiscovery />
        </CompareProvider>
      </main>,
    );

    await waitFor(() => expect(screen.getAllByText('Ada Obi').length).toBeGreaterThan(0));
    await expectNoA11yViolations(container);
  });
});
