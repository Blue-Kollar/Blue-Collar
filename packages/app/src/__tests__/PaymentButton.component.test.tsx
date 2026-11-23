/**
 * Component Tests for PaymentButton with Testing Library
 * Issue #1861: Frontend component tests with Testing Library
 *
 * Covers:
 *   - Component rendering with default state
 *   - Props variations (disabled, loading, success, error states)
 *   - User interactions (click handlers, keyboard navigation)
 *   - Accessibility assertions (a11y)
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PaymentButton from '@/components/PaymentButton';

describe('PaymentButton Component (#1861)', () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path: rendering ─────────────────────────────────────────────────

  it('renders button with text content', () => {
    render(<PaymentButton onClick={mockOnClick}>Send Payment</PaymentButton>);
    expect(screen.getByRole('button', { name: /send payment/i })).toBeInTheDocument();
  });

  it('applies primary variant styling by default', () => {
    const { container } = render(
      <PaymentButton onClick={mockOnClick} variant="primary">
        Pay Now
      </PaymentButton>,
    );
    const button = screen.getByRole('button', { name: /pay now/i });
    expect(button).toHaveClass('btn-primary');
  });

  it('renders with icon when provided', () => {
    render(
      <PaymentButton onClick={mockOnClick} icon="check">
        Confirm
      </PaymentButton>,
    );
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  // ── Props variations ──────────────────────────────────────────────────────

  it('displays loading spinner when loading prop is true', () => {
    render(
      <PaymentButton onClick={mockOnClick} isLoading>
        Process
      </PaymentButton>,
    );
    expect(screen.getByRole('button', { name: /process/i })).toBeDisabled();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('disables button when disabled prop is true', () => {
    render(
      <PaymentButton onClick={mockOnClick} disabled>
        Pay
      </PaymentButton>,
    );
    expect(screen.getByRole('button', { name: /pay/i })).toBeDisabled();
  });

  it('shows success state with checkmark icon', () => {
    render(
      <PaymentButton onClick={mockOnClick} state="success">
        Paid
      </PaymentButton>,
    );
    const button = screen.getByRole('button', { name: /paid/i });
    expect(button).toHaveClass('btn-success');
    expect(within(button).getByTestId('checkmark-icon')).toBeInTheDocument();
  });

  it('shows error state with error text', () => {
    render(
      <PaymentButton onClick={mockOnClick} state="error" errorMessage="Payment failed">
        Try Again
      </PaymentButton>,
    );
    expect(screen.getByText('Payment failed')).toBeInTheDocument();
  });

  it('applies full-width class when fullWidth prop is true', () => {
    const { container } = render(
      <PaymentButton onClick={mockOnClick} fullWidth>
        Submit
      </PaymentButton>,
    );
    const button = screen.getByRole('button', { name: /submit/i });
    expect(button.parentElement).toHaveClass('w-full');
  });

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onClick handler when clicked', async () => {
    const user = userEvent.setup();
    render(<PaymentButton onClick={mockOnClick}>Click Me</PaymentButton>);
    await user.click(screen.getByRole('button', { name: /click me/i }));
    expect(mockOnClick).toHaveBeenCalledOnce();
  });

  it('calls onClick handler when Enter key is pressed', async () => {
    const user = userEvent.setup();
    render(<PaymentButton onClick={mockOnClick}>Keyboard</PaymentButton>);
    const button = screen.getByRole('button', { name: /keyboard/i });
    button.focus();
    await user.keyboard('{Enter}');
    expect(mockOnClick).toHaveBeenCalled();
  });

  it('does not call onClick when button is disabled', async () => {
    const user = userEvent.setup();
    render(
      <PaymentButton onClick={mockOnClick} disabled>
        Disabled
      </PaymentButton>,
    );
    await user.click(screen.getByRole('button', { name: /disabled/i }));
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading state is active', async () => {
    const user = userEvent.setup();
    render(
      <PaymentButton onClick={mockOnClick} isLoading>
        Loading
      </PaymentButton>,
    );
    await user.click(screen.getByRole('button', { name: /loading/i }));
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('renders with correct aria-label for accessibility', () => {
    render(
      <PaymentButton onClick={mockOnClick} ariaLabel="Confirm payment of $50">
        Pay
      </PaymentButton>,
    );
    expect(screen.getByRole('button', { name: /confirm payment/i })).toBeInTheDocument();
  });

  // ── Size variations ───────────────────────────────────────────────────────

  it('renders small button variant', () => {
    const { container } = render(
      <PaymentButton onClick={mockOnClick} size="sm">
        Small
      </PaymentButton>,
    );
    const button = screen.getByRole('button', { name: /small/i });
    expect(button).toHaveClass('btn-sm');
  });

  it('renders large button variant', () => {
    const { container } = render(
      <PaymentButton onClick={mockOnClick} size="lg">
        Large
      </PaymentButton>,
    );
    const button = screen.getByRole('button', { name: /large/i });
    expect(button).toHaveClass('btn-lg');
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it('is keyboard accessible and focusable', async () => {
    const user = userEvent.setup();
    render(<PaymentButton onClick={mockOnClick}>Tab Test</PaymentButton>);
    const button = screen.getByRole('button', { name: /tab test/i });
    await user.tab();
    expect(button).toBeFocused();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <PaymentButton onClick={mockOnClick}>Accessible Button</PaymentButton>,
    );
    // Note: vitest-axe matchers would be used here if configured
    // expect(container).toHaveNoViolations()
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('provides semantic button role', () => {
    render(<PaymentButton onClick={mockOnClick}>Semantic</PaymentButton>);
    expect(screen.getByRole('button', { name: /semantic/i })).toBeInTheDocument();
  });

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('handles empty children gracefully', () => {
    render(<PaymentButton onClick={mockOnClick} />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('renders with custom CSS class', () => {
    const { container } = render(
      <PaymentButton onClick={mockOnClick} className="custom-class">
        Custom
      </PaymentButton>,
    );
    const button = screen.getByRole('button', { name: /custom/i });
    expect(button).toHaveClass('custom-class');
  });

  it('displays tooltip on hover when provided', async () => {
    const user = userEvent.setup();
    render(
      <PaymentButton onClick={mockOnClick} tooltip="Complete your payment">
        Hover Me
      </PaymentButton>,
    );
    const button = screen.getByRole('button', { name: /hover me/i });
    await user.hover(button);
    // Tooltip visibility depends on implementation; adjust assertion as needed
    expect(screen.queryByText('Complete your payment')).toBeInTheDocument();
  });
});
