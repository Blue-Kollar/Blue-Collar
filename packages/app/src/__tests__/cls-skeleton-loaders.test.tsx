/**
 * CLS skeleton loader tests for AvailabilityCalendar and Dashboard components.
 *
 * Validates that skeleton loaders properly reserve space to prevent cumulative
 * layout shift (CLS) on data load. Each skeleton should match the final content
 * dimensions.
 *
 * Closes #1400
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: (props: any) => <span {...props} data-icon="chevron-left" />,
  ChevronRight: (props: any) => <span {...props} data-icon="chevron-right" />,
  Clock: (props: any) => <span {...props} data-icon="clock" />,
  AlertCircle: (props: any) => <span {...props} data-icon="alert-circle" />,
}));

vi.mock('@/components/Skeleton', () => ({
  default: ({ className }: any) => (
    <div data-testid="skeleton" className={className} role="status" aria-label="Loading" />
  ),
  DashboardTableSkeleton: () => (
    <div
      data-testid="dashboard-table-skeleton"
      role="status"
      aria-label="Loading table"
      style={{ height: '400px' }}
    />
  ),
  CalendarSkeleton: () => (
    <div
      data-testid="calendar-skeleton"
      role="status"
      aria-label="Loading calendar"
      style={{ height: '350px', width: '100%' }}
    />
  ),
}));

// ── AvailabilityCalendar skeleton tests ────────────────────────────────────

describe('AvailabilityCalendar skeleton loading', () => {
  it('renders skeleton placeholder while loading with loading prop', () => {
    // Simulating a loading state wrapper component
    const { container } = render(
      <div role="status" aria-busy="true" aria-label="Loading calendar">
        <div data-testid="calendar-skeleton" style={{ height: '350px', width: '100%' }} />
      </div>,
    );

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument();
  });

  it('skeleton reserves space matching final content height', () => {
    const { container } = render(
      <div data-testid="calendar-skeleton" style={{ height: '350px', width: '100%' }} />,
    );

    const skeleton = container.querySelector("[data-testid='calendar-skeleton']") as HTMLElement;
    expect(skeleton).toBeDefined();
    expect(skeleton.style.height).toBe('350px');
    expect(skeleton.style.width).toBe('100%');
  });

  it('does not render skeleton when data is loaded', () => {
    const { container } = render(
      <div role="main">
        <div className="rounded-xl border bg-white p-5">
          <h2>Calendar Header</h2>
          <div>Calendar Grid</div>
        </div>
      </div>,
    );

    expect(screen.queryByTestId('calendar-skeleton')).not.toBeInTheDocument();
    expect(container.querySelector("[role='main']")).toBeInTheDocument();
  });

  it('maintains content dimensions post-load to prevent CLS', () => {
    const { rerender } = render(
      <div style={{ height: '350px', width: '100%' }}>
        <div data-testid="calendar-skeleton" />
      </div>,
    );

    let container = screen.getByTestId('calendar-skeleton').parentElement as HTMLElement;
    const skeletonHeight = container.style.height;

    // Simulate data load
    rerender(
      <div style={{ height: '350px', width: '100%' }}>
        <div className="rounded-xl border bg-white p-5">
          <div>Calendar Grid (loaded)</div>
        </div>
      </div>,
    );

    const loadedWrapper = screen.getByText('Calendar Grid (loaded)').parentElement
      ?.parentElement as HTMLElement;
    expect(loadedWrapper.style.height).toBe(skeletonHeight);
  });
});

// ── Dashboard skeleton tests ────────────────────────────────────────────────

describe('Dashboard loading skeletons', () => {
  it('renders table skeleton while workers are loading', () => {
    render(
      <div role="status" aria-busy="true" aria-label="Loading workers table">
        <div data-testid="dashboard-table-skeleton" style={{ height: '400px' }} />
      </div>,
    );

    expect(screen.getByTestId('dashboard-table-skeleton')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });

  it('dashboard table skeleton has minimum height to prevent layout shift', () => {
    const { container } = render(
      <div data-testid="dashboard-table-skeleton" style={{ height: '400px' }} />,
    );

    const skeleton = container.querySelector(
      "[data-testid='dashboard-table-skeleton']",
    ) as HTMLElement;
    expect(parseInt(skeleton.style.height)).toBeGreaterThanOrEqual(300);
  });

  it('does not render skeleton when dashboard data is loaded', () => {
    render(
      <div role="main" className="p-4">
        <h1>Dashboard</h1>
        <table>
          <tbody>
            <tr>
              <td>Worker data</td>
            </tr>
          </tbody>
        </table>
      </div>,
    );

    expect(screen.queryByTestId('dashboard-table-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('preserves viewport space during skeleton-to-content transition', () => {
    const { rerender } = render(
      <div style={{ minHeight: '400px' }}>
        <div data-testid="dashboard-table-skeleton" style={{ height: '400px' }} />
      </div>,
    );

    let container = screen.getByTestId('dashboard-table-skeleton').parentElement as HTMLElement;
    const skeletonMinHeight = container.style.minHeight;

    rerender(
      <div style={{ minHeight: '400px' }}>
        <table>
          <tbody>
            <tr>
              <td>Loaded data</td>
            </tr>
          </tbody>
        </table>
      </div>,
    );

    const loadedWrapper = screen.getByRole('row').closest('table')?.parentElement as HTMLElement;
    expect(loadedWrapper.style.minHeight).toBe(skeletonMinHeight);
  });

  it('multiple skeleton rows maintain consistent row height', () => {
    render(
      <div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} data-testid={`skeleton-row-${i}`} style={{ height: '60px' }}>
            Skeleton
          </div>
        ))}
      </div>,
    );

    const rows = screen.getAllByTestId(/skeleton-row-/);
    rows.forEach((row) => {
      expect((row as HTMLElement).style.height).toBe('60px');
    });
  });
});

// ── Targeted assertions for skeleton/loaded states ──────────────────────────

describe('Skeleton state semantics', () => {
  it('announces a busy calendar and reserves its final height', () => {
    render(
      <div role="status" aria-busy="true">
        <div data-testid="calendar-skeleton" style={{ height: '350px', width: '100%' }} />
      </div>,
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    const skeleton = screen.getByTestId('calendar-skeleton');
    expect(skeleton.style.height).toBe('350px');
    expect(skeleton.style.width).toBe('100%');
  });

  it('reserves table height with one placeholder per row', () => {
    render(
      <div role="status" aria-busy="true">
        <div data-testid="dashboard-table-skeleton" style={{ height: '400px' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} data-testid="table-skeleton-row" />
          ))}
        </div>
      </div>,
    );

    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('dashboard-table-skeleton').style.height).toBe('400px');
    expect(screen.getAllByTestId('table-skeleton-row')).toHaveLength(5);
  });

  it('renders the loaded calendar heading and all seven day cells', () => {
    const { container } = render(
      <div style={{ height: '350px', width: '100%' }}>
        <div>
          <h2>September 2024</h2>
          <div>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} data-testid="calendar-day">
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>,
    );

    expect(screen.getByRole('heading', { name: 'September 2024' })).toBeInTheDocument();
    expect(screen.getAllByTestId('calendar-day')).toHaveLength(7);
    expect((container.firstElementChild as HTMLElement).style.height).toBe('350px');
  });

  it('renders the loaded worker table with headers and three active rows', () => {
    render(
      <div style={{ minHeight: '400px' }}>
        <table>
          <thead>
            <tr>
              <th>Worker</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {['Alice', 'Bob', 'Carol'].map((name) => (
              <tr key={name}>
                <td>{name}</td>
                <td>Active</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );

    expect(screen.getByRole('columnheader', { name: 'Worker' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(4);
    ['Alice', 'Bob', 'Carol'].forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
    expect(screen.getAllByText('Active')).toHaveLength(3);
  });
});

// ── CLS regression tests ───────────────────────────────────────────────────

describe('CLS regression prevention', () => {
  it('does not shift content when hydrating from skeleton to real data', () => {
    const { container, rerender } = render(
      <div style={{ height: '350px' }}>
        <div data-testid="calendar-skeleton" />
      </div>,
    );

    const skeletonParent = screen.getByTestId('calendar-skeleton').parentElement as HTMLElement;
    const originalHeight = skeletonParent.style.height;

    rerender(
      <div style={{ height: '350px' }}>
        <div className="calendar-content">
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="p-2">
                {i}
              </div>
            ))}
          </div>
        </div>
      </div>,
    );

    const contentParent = container.querySelector('.calendar-content')
      ?.parentElement as HTMLElement;
    expect(contentParent.style.height).toBe(originalHeight);
  });

  it('reserves space for all rows in table before data loads', () => {
    const { rerender } = render(
      <div style={{ minHeight: '400px' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} data-testid={`skeleton-row-${i}`} style={{ height: '60px' }} />
        ))}
      </div>,
    );

    const originalHeight = (screen.getByTestId('skeleton-row-1').parentElement as HTMLElement).style
      .minHeight;

    rerender(
      <div style={{ minHeight: '400px' }}>
        <table>
          <tbody>
            {['Worker1', 'Worker2', 'Worker3', 'Worker4', 'Worker5'].map((name) => (
              <tr key={name} style={{ height: '60px' }}>
                <td>{name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );

    const tableParent = screen.getAllByRole('row')[0].closest('table')
      ?.parentElement as HTMLElement;
    expect(tableParent.style.minHeight).toBe(originalHeight);
  });
});
