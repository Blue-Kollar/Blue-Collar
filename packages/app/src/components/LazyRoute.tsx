import React, { Suspense, ComponentType, ReactNode } from 'react';

export interface LazyRouteProps {
  /**
   * A lazily-loaded component, typically created with `React.lazy(() => import(...))`.
   */
  component: ComponentType<any>;
  /**
   * Optional custom fallback to render while the lazy component is loading.
   * Defaults to a simple accessible loading indicator.
   */
  fallback?: ReactNode;
  /**
   * Optional error fallback rendered if the lazy component fails to load.
   */
  errorFallback?: ReactNode;
  /**
   * Any props to forward to the lazily-loaded component.
   */
  [key: string]: any;
}

const DefaultFallback: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    aria-busy="true"
    data-testid="lazy-route-fallback"
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '200px',
      width: '100%',
    }}
  >
    <span>Loading…</span>
  </div>
);

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Minimal error boundary so a failed dynamic import (e.g. network error)
 * does not crash the whole app.
 */
class LazyRouteErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    // Surface the failure for observability without breaking the app.
    // eslint-disable-next-line no-console
    console.error('LazyRoute failed to load component:', error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

/**
 * LazyRoute wraps a `React.lazy` component with `Suspense` and an error
 * boundary, providing a consistent loading experience for heavy routes.
 *
 * Usage:
 * ```tsx
 * const Dashboard = React.lazy(() => import('../pages/Dashboard'));
 *
 * <LazyRoute component={Dashboard} someProp="value" />
 * ```
 */
export const LazyRoute: React.FC<LazyRouteProps> = ({
  component: Component,
  fallback,
  errorFallback,
  ...rest
}) => {
  return (
    <LazyRouteErrorBoundary
      fallback={
        errorFallback ?? (
          <div role="alert" data-testid="lazy-route-error">
            Failed to load this section. Please try again.
          </div>
        )
      }
    >
      <Suspense fallback={fallback ?? <DefaultFallback />}>
        <Component {...rest} />
      </Suspense>
    </LazyRouteErrorBoundary>
  );
};

export default LazyRoute;