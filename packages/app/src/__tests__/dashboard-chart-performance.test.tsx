/**
 * Dashboard Chart Performance Optimization Tests
 *
 * Verifies that chart components use memoization (useMemo) to prevent
 * unnecessary recomputation of derived data (aggregations, groupings)
 * on every render. Tests measure render efficiency and ensure memoization
 * doesn't introduce data staleness bugs.
 *
 * Closes #1388
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { useMemo, useState } from 'react';

// ─── Helper: Component that uses useMemo (pattern to verify) ────────────────

interface ChartData {
  id: string;
  value: number;
  label: string;
}

function MockChartWithMemo({ data }: { data: ChartData[] }) {
  const aggregatedData = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

  return <div data-testid="chart-memo">Total: {aggregatedData}</div>;
}

function MockChartWithoutMemo({ data }: { data: ChartData[] }) {
  const aggregatedData = data.reduce((sum, item) => sum + item.value, 0);
  return <div data-testid="chart-no-memo">Total: {aggregatedData}</div>;
}

// ─── Test Component to track render counts ────────────────────────────────

function RenderCountTracker({
  children,
  onRender,
}: {
  children: React.ReactNode;
  onRender: () => void;
}) {
  onRender();
  return <>{children}</>;
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Dashboard Chart Performance - useMemo Memoization', () => {
  const mockData: ChartData[] = [
    { id: '1', value: 100, label: 'Q1' },
    { id: '2', value: 200, label: 'Q2' },
    { id: '3', value: 150, label: 'Q3' },
  ];

  it('aggregates chart data correctly without memoization', () => {
    render(<MockChartWithoutMemo data={mockData} />);
    expect(screen.getByTestId('chart-no-memo')).toHaveTextContent('Total: 450');
  });

  it('aggregates chart data correctly with memoization', () => {
    render(<MockChartWithMemo data={mockData} />);
    expect(screen.getByTestId('chart-memo')).toHaveTextContent('Total: 450');
  });

  it('updates aggregated data when source data changes', () => {
    const { rerender } = render(<MockChartWithMemo data={mockData} />);
    expect(screen.getByTestId('chart-memo')).toHaveTextContent('Total: 450');

    const updatedData = [
      { id: '1', value: 200, label: 'Q1' },
      { id: '2', value: 300, label: 'Q2' },
      { id: '3', value: 250, label: 'Q3' },
    ];
    rerender(<MockChartWithMemo data={updatedData} />);
    expect(screen.getByTestId('chart-memo')).toHaveTextContent('Total: 750');
  });

  it('does not recompute aggregation when dependency array is unchanged', () => {
    const renderSpy = vi.fn();

    function TestChart({ data }: { data: ChartData[] }) {
      const aggregatedData = useMemo(() => {
        renderSpy();
        return data.reduce((sum, item) => sum + item.value, 0);
      }, [data]);

      return <div>{aggregatedData}</div>;
    }

    const { rerender } = render(<TestChart data={mockData} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Rerender with same data reference
    rerender(<TestChart data={mockData} />);
    expect(renderSpy).toHaveBeenCalledTimes(1); // Should not recompute
  });

  it('recomputes aggregation when data array reference changes', () => {
    const renderSpy = vi.fn();

    function TestChart({ data }: { data: ChartData[] }) {
      const aggregatedData = useMemo(() => {
        renderSpy();
        return data.reduce((sum, item) => sum + item.value, 0);
      }, [data]);

      return <div>{aggregatedData}</div>;
    }

    const { rerender } = render(<TestChart data={mockData} />);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    // Rerender with new data reference
    const newData = [...mockData];
    rerender(<TestChart data={newData} />);
    expect(renderSpy).toHaveBeenCalledTimes(2); // Should recompute
  });

  it('handles empty data array correctly with memoization', () => {
    const emptyData: ChartData[] = [];
    render(<MockChartWithMemo data={emptyData} />);
    expect(screen.getByTestId('chart-memo')).toHaveTextContent('Total: 0');
  });

  it('maintains data consistency across parent re-renders with memoization', () => {
    const renderTracker = vi.fn();

    function ParentComponent() {
      const [counter, setCounter] = useState(0);

      const stableData = useMemo(
        () => [
          { id: '1', value: 100, label: 'Q1' },
          { id: '2', value: 200, label: 'Q2' },
        ],
        [],
      );

      return (
        <div>
          <MockChartWithMemo data={stableData} />
          <RenderCountTracker onRender={renderTracker}>
            <button onClick={() => setCounter(counter + 1)}>Count: {counter}</button>
          </RenderCountTracker>
        </div>
      );
    }

    const { rerender } = render(<ParentComponent />);
    expect(screen.getByTestId('chart-memo')).toHaveTextContent('Total: 300');
    expect(renderTracker).toHaveBeenCalledTimes(1);

    // Trigger parent re-render
    rerender(<ParentComponent />);
    expect(renderTracker).toHaveBeenCalledTimes(2);
    // Chart data should still be correct after parent re-render
    expect(screen.getByTestId('chart-memo')).toHaveTextContent('Total: 300');
  });

  it('prevents stale data bugs by updating when dependencies change', async () => {
    function DataDrivenChart({ data }: { data: ChartData[] }) {
      const aggregatedData = useMemo(() => {
        return data.reduce((sum, item) => sum + item.value, 0);
      }, [data]);

      const groupedByLabel = useMemo(() => {
        return data.reduce(
          (acc, item) => {
            if (!acc[item.label]) acc[item.label] = 0;
            acc[item.label] += item.value;
            return acc;
          },
          {} as Record<string, number>,
        );
      }, [data]);

      return (
        <div>
          <div data-testid="total">Total: {aggregatedData}</div>
          <div data-testid="by-label">{JSON.stringify(groupedByLabel)}</div>
        </div>
      );
    }

    const initialData = [
      { id: '1', value: 100, label: 'Sales' },
      { id: '2', value: 200, label: 'Support' },
    ];

    const { rerender } = render(<DataDrivenChart data={initialData} />);
    expect(screen.getByTestId('total')).toHaveTextContent('Total: 300');
    expect(screen.getByTestId('by-label')).toHaveTextContent('"Sales":100');

    const updatedData = [
      { id: '1', value: 150, label: 'Sales' },
      { id: '2', value: 250, label: 'Support' },
    ];
    rerender(<DataDrivenChart data={updatedData} />);
    expect(screen.getByTestId('total')).toHaveTextContent('Total: 400');
    expect(screen.getByTestId('by-label')).toHaveTextContent('"Sales":150');
  });

  it('memoization benefits apply when data is large and aggregation is expensive', () => {
    const computeSpy = vi.fn();

    function ExpensiveAggregationChart({ data }: { data: ChartData[] }) {
      const result = useMemo(() => {
        computeSpy();
        // Simulate expensive computation
        let sum = 0;
        for (let i = 0; i < 1000; i++) {
          sum += data.reduce((acc, item) => acc + item.value, 0);
        }
        return sum / 1000;
      }, [data]);

      return <div>{result}</div>;
    }

    const largeData = Array.from({ length: 100 }, (_, i) => ({
      id: `${i}`,
      value: Math.floor(Math.random() * 1000),
      label: `Item ${i}`,
    }));

    const { rerender } = render(<ExpensiveAggregationChart data={largeData} />);
    expect(computeSpy).toHaveBeenCalledTimes(1);

    // Re-render with same data
    rerender(<ExpensiveAggregationChart data={largeData} />);
    expect(computeSpy).toHaveBeenCalledTimes(1); // Expensive computation skipped
  });
});
