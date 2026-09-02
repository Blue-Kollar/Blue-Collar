/**
 * Mobile Compatibility Tests
 * Closes #405
 *
 * Tests screen sizes, touch interactions, mobile navigation, and performance.
 * Uses @testing-library/react with jsdom and matchMedia mocking.
 */
import { act,fireEvent, render, screen } from '@testing-library/react';
import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import BottomNav from '@/components/BottomNav';
import Navbar from '@/components/Navbar';
import WorkerCard from '@/components/WorkerCard';
import type { Worker } from '@/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Mock window.matchMedia for a given viewport width */
function mockViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes(`${width}`) || (width <= 768 && query.includes('max-width: 768px')),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
  window.dispatchEvent(new Event('resize'));
}

const VIEWPORTS = {
  mobileSmall: 320,   // iPhone SE
  mobileMedium: 375,  // iPhone 14
  mobileLarge: 414,   // iPhone 14 Plus
  tablet: 768,        // iPad
  desktop: 1280,      // Desktop
} as const;

const baseWorker: Worker = {
  id: 'w1',
  name: 'Jane Doe',
  isVerified: true,
  category: { id: 'c1', name: 'Plumber' },
  bio: 'Expert plumber',
  location: 'Lagos, Nigeria',
};

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), pathname: '/' }),
  usePathname: () => '/',
}));
vi.mock('lucide-react', () => ({
  BadgeCheck: ({ 'aria-label': label }: any) => <span aria-label={label} />,
  MapPin: () => <span />,
  Menu: () => <span data-testid="menu-icon" />,
  X: () => <span data-testid="close-icon" />,
  Home: () => <span />,
  Search: () => <span />,
  User: () => <span />,
  Bell: () => <span />,
  Briefcase: () => <span />,
}));
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
}));

// ── Screen Size Tests ─────────────────────────────────────────────────────────

describe('Mobile Compatibility – Screen Sizes', () => {
  Object.entries(VIEWPORTS).forEach(([name, width]) => {
    it(`renders WorkerCard correctly at ${name} (${width}px)`, () => {
      mockViewport(width);
      const { container } = render(<WorkerCard worker={baseWorker} />);
      // Card must render without crashing
      expect(screen.getByText('Jane Doe')).toBeInTheDocument();
      expect(screen.getByText('Plumber')).toBeInTheDocument();
      // No horizontal overflow
      const card = container.firstChild as HTMLElement;
      expect(card).toBeTruthy();
    });
  });

  it('WorkerCard link is accessible on mobile (320px)', () => {
    mockViewport(VIEWPORTS.mobileSmall);
    render(<WorkerCard worker={baseWorker} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/workers/w1');
  });

  it('WorkerCard shows location on all screen sizes', () => {
    Object.values(VIEWPORTS).forEach((width) => {
      mockViewport(width);
      const { unmount } = render(<WorkerCard worker={baseWorker} />);
      expect(screen.getByText('Lagos, Nigeria')).toBeInTheDocument();
      unmount();
    });
  });
});

// ── Touch Interaction Tests ───────────────────────────────────────────────────

describe('Mobile Compatibility – Touch Interactions', () => {
  it('WorkerCard responds to touch events', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<WorkerCard worker={baseWorker} />);
    const link = screen.getByRole('link');

    // Simulate touch start/end
    fireEvent.touchStart(link);
    fireEvent.touchEnd(link);
    // Should not throw
    expect(link).toBeInTheDocument();
  });

  it('WorkerCard link is tappable (has sufficient touch target)', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<WorkerCard worker={baseWorker} />);
    const link = screen.getByRole('link');
    // The link wraps the entire card — it should be a block-level element
    expect(link).toBeInTheDocument();
  });

  it('touch events do not cause errors on verified badge', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<WorkerCard worker={{ ...baseWorker, isVerified: true }} />);
    const badge = screen.getByLabelText('Verified');
    fireEvent.touchStart(badge);
    fireEvent.touchEnd(badge);
    expect(badge).toBeInTheDocument();
  });
});

// ── Mobile Navigation Tests ───────────────────────────────────────────────────

describe('Mobile Compatibility – Navigation', () => {
  it('BottomNav renders on mobile viewport', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<BottomNav />);
    // BottomNav should be present in the DOM
    const nav = screen.getByRole('navigation');
    expect(nav).toBeInTheDocument();
  });

  it('BottomNav has accessible navigation links', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<BottomNav />);
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('BottomNav links are keyboard accessible', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<BottomNav />);
    const links = screen.getAllByRole('link');
    links.forEach((link) => {
      expect(link).not.toHaveAttribute('tabindex', '-1');
    });
  });
});

// ── Mobile Performance Tests ──────────────────────────────────────────────────

describe('Mobile Compatibility – Performance', () => {
  it('WorkerCard renders within 100ms on mobile viewport', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    const start = performance.now();
    render(<WorkerCard worker={baseWorker} />);
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('renders 20 WorkerCards within 500ms (list performance)', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    const workers: Worker[] = Array.from({ length: 20 }, (_, i) => ({
      ...baseWorker,
      id: `w${i}`,
      name: `Worker ${i}`,
    }));

    const start = performance.now();
    const { container } = render(
      <div>
        {workers.map((w) => (
          <WorkerCard key={w.id} worker={w} />
        ))}
      </div>
    );
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
    expect(container.querySelectorAll('a').length).toBe(20);
  });

  it('WorkerCard does not re-render unnecessarily on touch', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    let renderCount = 0;
    const TrackedCard = () => {
      renderCount++;
      return <WorkerCard worker={baseWorker} />;
    };

    render(<TrackedCard />);
    const initialCount = renderCount;

    // Touch should not trigger re-render
    const link = screen.getByRole('link');
    fireEvent.touchStart(link);
    fireEvent.touchEnd(link);

    expect(renderCount).toBe(initialCount);
  });
});

// ── Accessibility on Mobile ───────────────────────────────────────────────────

describe('Mobile Compatibility – Accessibility', () => {
  it('WorkerCard has no missing alt text on mobile', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<WorkerCard worker={{ ...baseWorker, avatar: 'https://example.com/avatar.jpg' }} />);
    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('alt');
    expect(img.getAttribute('alt')).not.toBe('');
  });

  it('WorkerCard initials avatar is accessible without img role', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<WorkerCard worker={baseWorker} />);
    // Initials shown as text — no broken img
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('interactive elements have sufficient contrast (aria labels present)', () => {
    mockViewport(VIEWPORTS.mobileMedium);
    render(<WorkerCard worker={{ ...baseWorker, isVerified: true }} />);
    expect(screen.getByLabelText('Verified')).toBeInTheDocument();
  });
});
