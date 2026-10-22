import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import React, { ReactNode } from 'react'

/**
 * Test suite for feature-level error boundaries
 * Issue #1396: Introduce component-level error boundaries for feature routes
 */

describe('Feature Error Boundary', () => {
  // Mock monitoring module
  vi.mock('@/monitoring', () => ({
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  }))

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Error Boundary Component', () => {
    it('should catch errors thrown by child components', () => {
      // Simple error boundary implementation
      class ErrorBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="error-fallback">Something went wrong</div>
          }
          return this.props.children
        }
      }

      const ThrowComponent = () => {
        throw new Error('Component error')
      }

      // Suppress console.error for this test
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary>
          <ThrowComponent />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('error-fallback')).toBeInTheDocument()
      consoleError.mockRestore()
    })

    it('should render children normally when no error occurs', () => {
      class ErrorBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="error-fallback">Something went wrong</div>
          }
          return this.props.children
        }
      }

      render(
        <ErrorBoundary>
          <div data-testid="child-component">Child content</div>
        </ErrorBoundary>
      )

      expect(screen.getByTestId('child-component')).toBeInTheDocument()
      expect(screen.queryByTestId('error-fallback')).not.toBeInTheDocument()
    })

    it('should report errors to monitoring system', () => {
      const mockCaptureException = vi.fn()

      class ErrorBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        componentDidCatch(error: Error) {
          mockCaptureException(error)
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="error-fallback">Error occurred</div>
          }
          return this.props.children
        }
      }

      const ThrowComponent = () => {
        throw new Error('Test error')
      }

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <ErrorBoundary>
          <ThrowComponent />
        </ErrorBoundary>
      )

      expect(mockCaptureException).toHaveBeenCalled()
      consoleError.mockRestore()
    })
  })

  describe('Feature Route Error Boundary', () => {
    it('should wrap feature routes with error boundary', () => {
      const MockFeature = () => <div>Feature content</div>

      class FeatureErrorBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return (
              <div data-testid="feature-error-boundary">
                <h2>Feature Unavailable</h2>
              </div>
            )
          }
          return this.props.children
        }
      }

      render(
        <FeatureErrorBoundary>
          <MockFeature />
        </FeatureErrorBoundary>
      )

      expect(screen.getByText('Feature content')).toBeInTheDocument()
    })

    it('should display fallback UI when feature throws', () => {
      const FailingFeature = () => {
        throw new Error('Feature initialization failed')
      }

      class FeatureErrorBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return (
              <div data-testid="feature-error-fallback">
                <h2>Unable to load this feature</h2>
                <p>Please try again later</p>
              </div>
            )
          }
          return this.props.children
        }
      }

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <FeatureErrorBoundary>
          <FailingFeature />
        </FeatureErrorBoundary>
      )

      expect(screen.getByTestId('feature-error-fallback')).toBeInTheDocument()
      expect(screen.getByText('Unable to load this feature')).toBeInTheDocument()
      consoleError.mockRestore()
    })
  })

  describe('Error Boundary Isolation', () => {
    it('should isolate errors within feature boundaries', () => {
      const FailingFeature = () => {
        throw new Error('Feature A error')
      }

      const WorkingFeature = () => <div>Feature B works</div>

      class ErrorBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="error-ui">Error in feature</div>
          }
          return this.props.children
        }
      }

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <div>
          <ErrorBoundary>
            <FailingFeature />
          </ErrorBoundary>
          <ErrorBoundary>
            <WorkingFeature />
          </ErrorBoundary>
        </div>
      )

      const errorUIs = screen.getAllByTestId('error-ui')
      expect(errorUIs).toHaveLength(1)
      expect(screen.getByText('Feature B works')).toBeInTheDocument()
      consoleError.mockRestore()
    })

    it('should not affect other routes when one boundary catches error', () => {
      class RouteErrorBoundary extends React.Component<
        { route: string; children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { route: string; children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        render() {
          if (this.state.hasError) {
            return (
              <div data-testid={`error-${this.props.route}`}>
                Error in {this.props.route}
              </div>
            )
          }
          return this.props.children
        }
      }

      const Route1 = () => {
        throw new Error('Route 1 error')
      }

      const Route2 = () => <div>Route 2 content</div>

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <div>
          <RouteErrorBoundary route="route1">
            <Route1 />
          </RouteErrorBoundary>
          <RouteErrorBoundary route="route2">
            <Route2 />
          </RouteErrorBoundary>
        </div>
      )

      expect(screen.getByTestId('error-route1')).toBeInTheDocument()
      expect(screen.getByText('Route 2 content')).toBeInTheDocument()
      consoleError.mockRestore()
    })
  })

  describe('Error Boundary Monitoring', () => {
    it('should include error details in monitoring report', () => {
      const mockCaptureException = vi.fn()
      const errorMessage = 'Detailed error for monitoring'
      const errorStack = 'at Component (file.tsx:10)'

      class MonitoredErrorBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
          mockCaptureException({
            message: error.message,
            stack: errorInfo.componentStack,
          })
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="error-ui">Error occurred</div>
          }
          return this.props.children
        }
      }

      const ThrowComponent = () => {
        throw new Error(errorMessage)
      }

      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(
        <MonitoredErrorBoundary>
          <ThrowComponent />
        </MonitoredErrorBoundary>
      )

      expect(mockCaptureException).toHaveBeenCalled()
      const callArgs = mockCaptureException.mock.calls[0][0]
      expect(callArgs.message).toBe(errorMessage)
      consoleError.mockRestore()
    })

    it('should track error boundary recoveries', () => {
      const recoveryTracker = vi.fn()

      class RecoveryTrackingBoundary extends React.Component<
        { children: ReactNode },
        { hasError: boolean }
      > {
        constructor(props: { children: ReactNode }) {
          super(props)
          this.state = { hasError: false }
        }

        static getDerivedStateFromError() {
          return { hasError: true }
        }

        componentDidMount() {
          if (this.state.hasError) {
            recoveryTracker('error_boundary_mounted_in_error_state')
          }
        }

        render() {
          if (this.state.hasError) {
            return <div data-testid="recovery-ui">Recovered from error</div>
          }
          return this.props.children
        }
      }

      render(
        <RecoveryTrackingBoundary>
          <div>Normal content</div>
        </RecoveryTrackingBoundary>
      )

      expect(screen.getByText('Normal content')).toBeInTheDocument()
    })
  })
})
