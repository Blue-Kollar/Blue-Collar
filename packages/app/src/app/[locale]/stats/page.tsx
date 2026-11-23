'use client';

import { useProtocolMetrics } from '@/hooks/queries';
import { StatsPageSkeleton } from '@/components/stats/StatsPageSkeleton';
import { StatsHeader } from '@/components/stats/StatsHeader';
import { StatsGrid } from '@/components/stats/StatsGrid';

// New file: packages/app/src/components/stats/StatsPageSkeleton.tsx
('use client');

import Skeleton from '@/components/Skeleton';

export function StatsPageSkeleton() {
  return (
    <div className="container mx-auto p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    </div>
  );
}

// New file: packages/app/src/components/stats/StatsHeader.tsx
('use client');

import { formatDate } from '@/lib/utils';

interface StatsHeaderProps {
  dataFreshness: string | number | Date;
}

export function StatsHeader({ dataFreshness }: StatsHeaderProps) {
  return (
    <div className="flex justify-between items-center">
      <h1 className="text-3xl font-bold">Protocol Health Dashboard</h1>
      <span className="text-sm text-muted-foreground">
        Last updated:{' '}
        {formatDate(dataFreshness, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </span>
    </div>
  );
}

// New file: packages/app/src/components/stats/StatCard.tsx
('use client');

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
}

export function StatCard({ title, value, subtitle }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

// New file: packages/app/src/components/stats/StatsGrid.tsx
('use client');

import { StatCard } from '@/components/stats/StatCard';

interface StatsGridMetrics {
  totalRegistrations: number;
  activeWorkers: number;
  totalTipVolume: number;
  totalTipCount: number;
  totalEscrowVolume: number;
  activeEscrows: number;
  totalDisputes: number;
  resolvedDisputes: number;
}

interface StatsGridProps {
  metrics: StatsGridMetrics;
}

export function StatsGrid({ metrics }: StatsGridProps) {
  const disputeRate =
    metrics.totalDisputes > 0
      ? ((metrics.resolvedDisputes / metrics.totalDisputes) * 100).toFixed(1)
      : '0';

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard title="Total Registrations" value={metrics.totalRegistrations} />
      <StatCard title="Active Workers" value={metrics.activeWorkers} />
      <StatCard
        title="Total Tips (XLM)"
        value={metrics.totalTipVolume.toFixed(2)}
        subtitle={`${metrics.totalTipCount} transactions`}
      />
      <StatCard
        title="Escrow Volume (XLM)"
        value={metrics.totalEscrowVolume.toFixed(2)}
        subtitle={`${metrics.activeEscrows} active`}
      />
      <StatCard title="Total Disputes" value={metrics.totalDisputes} />
      <StatCard
        title="Resolved Disputes"
        value={metrics.resolvedDisputes}
        subtitle={`${disputeRate}% resolution rate`}
      />
    </div>
  );
}

// New file: packages/app/src/components/stats/__tests__/StatsPage.test.tsx
import { render, screen } from '@testing-library/react';
import StatsPage from '@/app/[locale]/stats/page';
import { useProtocolMetrics } from '@/hooks/queries';

jest.mock('@/hooks/queries', () => ({
  useProtocolMetrics: jest.fn(),
}));

const mockedUseProtocolMetrics = useProtocolMetrics as jest.Mock;

const baseMetrics = {
  dataFreshness: '2024-01-01T00:00:00.000Z',
  totalRegistrations: 120,
  activeWorkers: 45,
  totalTipVolume: 1234.567,
  totalTipCount: 89,
  totalEscrowVolume: 9876.543,
  activeEscrows: 12,
  totalDisputes: 10,
  resolvedDisputes: 8,
};

describe('StatsPage', () => {
  it('renders the loading skeleton while loading', () => {
    mockedUseProtocolMetrics.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<StatsPage />);
    expect(container.querySelectorAll('.h-32').length).toBe(8);
  });

  it('renders a failure message when metrics are missing', () => {
    mockedUseProtocolMetrics.mockReturnValue({ data: undefined, isLoading: false });
    render(<StatsPage />);
    expect(screen.getByText('Failed to load metrics')).toBeInTheDocument();
  });

  it('renders the dashboard with formatted metrics', () => {
    mockedUseProtocolMetrics.mockReturnValue({ data: baseMetrics, isLoading: false });
    render(<StatsPage />);

    expect(screen.getByText('Protocol Health Dashboard')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('1234.57')).toBeInTheDocument();
    expect(screen.getByText('89 transactions')).toBeInTheDocument();
    expect(screen.getByText('9876.54')).toBeInTheDocument();
    expect(screen.getByText('12 active')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('80.0% resolution rate')).toBeInTheDocument();
  });

  it('shows 0% resolution rate when there are no disputes', () => {
    mockedUseProtocolMetrics.mockReturnValue({
      data: { ...baseMetrics, totalDisputes: 0, resolvedDisputes: 0 },
      isLoading: false,
    });
    render(<StatsPage />);
    expect(screen.getByText('0% resolution rate')).toBeInTheDocument();
  });
});

// New file: packages/app/src/components/stats/__tests__/StatsGrid.test.tsx
import { render, screen } from '@testing-library/react';
import { StatsGrid } from '@/components/stats/StatsGrid';

const metrics = {
  totalRegistrations: 1,
  activeWorkers: 2,
  totalTipVolume: 3.456,
  totalTipCount: 4,
  totalEscrowVolume: 5.678,
  activeEscrows: 6,
  totalDisputes: 7,
  resolvedDisputes: 7,
};

describe('StatsGrid', () => {
  it('renders all stat cards with formatted values', () => {
    render(<StatsGrid metrics={metrics} />);
    expect(screen.getByText('Total Registrations')).toBeInTheDocument();
    expect(screen.getByText('3.46')).toBeInTheDocument();
    expect(screen.getByText('5.68')).toBeInTheDocument();
    expect(screen.getByText('100.0% resolution rate')).toBeInTheDocument();
  });
});

// New file: packages/app/src/components/stats/__tests__/StatCard.test.tsx
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/stats/StatCard';

describe('StatCard', () => {
  it('renders title and value without subtitle', () => {
    render(<StatCard title="Active Workers" value={42} />);
    expect(screen.getByText('Active Workers')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatCard title="Total Tips (XLM)" value="10.00" subtitle="3 transactions" />);
    expect(screen.getByText('3 transactions')).toBeInTheDocument();
  });
});

// New file: packages/app/src/components/stats/__tests__/StatsHeader.test.tsx
import { render, screen } from '@testing-library/react';
import { StatsHeader } from '@/components/stats/StatsHeader';

describe('StatsHeader', () => {
  it('renders the dashboard title and last updated timestamp', () => {
    render(<StatsHeader dataFreshness="2024-01-01T00:00:00.000Z" />);
    expect(screen.getByText('Protocol Health Dashboard')).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });
});

// New file: packages/app/src/components/stats/__tests__/StatsPageSkeleton.test.tsx
import { render } from '@testing-library/react';
import { StatsPageSkeleton } from '@/components/stats/StatsPageSkeleton';

describe('StatsPageSkeleton', () => {
  it('renders eight placeholder cards', () => {
    const { container } = render(<StatsPageSkeleton />);
    expect(container.querySelectorAll('.h-32').length).toBe(8);
  });
});

export default function StatsPage() {
  const { data: metrics, isLoading: loading } = useProtocolMetrics();

  if (loading) {
    return <StatsPageSkeleton />;
  }

  if (!metrics) return <div className="container mx-auto p-6">Failed to load metrics</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <StatsHeader dataFreshness={metrics.dataFreshness} />
      <StatsGrid metrics={metrics} />
    </div>
  );
}
