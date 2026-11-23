import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ErrorBoundary, RouteErrorBoundary } from '../ErrorBoundary';

// Component that throws on render to trigger the error boundary.
function ThrowingChild({ shouldThrow = true }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error('Test render crash');
  }
  return <div>Child rendered successfully</div>;
}

describe('ErrorBoundary (class wrapper)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // React logs caught errors to console.error; silence during tests.
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>Safe child</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Safe child')).toBeInTheDocument();
  });

  it('renders the fallback UI instead of a blank screen when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    // Fallback title/description should be visible.
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    // Retry button should be present.
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    // The crashing child must not be rendered.
    expect(screen.queryByText('Child rendered successfully')).not.toBeInTheDocument();
  });

  it('calls the provided reset handler when retry is clicked', () => {
    const handleReset = vi.fn();

    render(
      <ErrorBoundary onReset={handleReset}>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('recovers and re-renders children after retry when the error is resolved', () => {
    let shouldThrow = true;

    function FlakyChild() {
      if (shouldThrow) {
        throw new Error('Flaky crash');
      }
      return <div>Recovered child</div>;
    }

    render(
      <ErrorBoundary>
        <FlakyChild />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();

    // Resolve the error condition, then retry.
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.getByText('Recovered child')).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /something went wrong/i }),
    ).not.toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom fallback</div>}>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom fallback')).toBeInTheDocument();
  });

  it('copies the error report to the clipboard when the report button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <ErrorBoundary>
        <ThrowingChild />
      </ErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy error report/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Test render crash');
  });
});

describe('RouteErrorBoundary', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when no error occurs', () => {
    render(
      <RouteErrorBoundary routeName="Dashboard">
        <div>Route content</div>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText('Route content')).toBeInTheDocument();
  });

  it('renders the route-scoped fallback when a child throws', () => {
    render(
      <RouteErrorBoundary routeName="Dashboard">
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument();
    expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.queryByText('Child rendered successfully')).not.toBeInTheDocument();
  });

  it('includes the route name in the fallback description', () => {
    render(
      <RouteErrorBoundary routeName="Dashboard">
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  });

  it('calls reset when retry is clicked', () => {
    const handleReset = vi.fn();

    render(
      <RouteErrorBoundary routeName="Dashboard" onReset={handleReset}>
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));

    expect(handleReset).toHaveBeenCalledTimes(1);
  });

  it('copies the error report to the clipboard when the report button is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(
      <RouteErrorBoundary routeName="Dashboard">
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    fireEvent.click(screen.getByRole('button', { name: /copy error report/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Test render crash');
  });
});
