/**
 * Component Tests for TipModal with Testing Library
 * Issue #1861: Frontend component tests with Testing Library
 *
 * Covers:
 *   - Modal rendering and visibility
 *   - Form input handling
 *   - Amount validation
 *   - Submit and cancel actions
 *   - Accessibility
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TipModal from '@/components/TipModal';

describe('TipModal Component (#1861)', () => {
  const mockOnSubmit = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path: rendering ─────────────────────────────────────────────────

  it('renders modal when open prop is true', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/send a tip/i)).toBeInTheDocument();
  });

  it('displays worker name in modal title', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="Alice Smith"
        defaultAmount={10}
      />,
    );
    expect(screen.getByText(/alice smith/i)).toBeInTheDocument();
  });

  it('does not render modal when open prop is false', () => {
    render(
      <TipModal
        open={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  // ── Form fields ───────────────────────────────────────────────────────────

  it('displays amount input field with label', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    expect(screen.getByLabelText(/amount|tip/i)).toBeInTheDocument();
  });

  it('pre-fills amount input with default value', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={25}
      />,
    );
    const amountInput = screen.getByLabelText(/amount|tip/i) as HTMLInputElement;
    expect(amountInput.value).toBe('25');
  });

  it('displays optional message field', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    expect(screen.getByPlaceholderText(/message|note/i)).toBeInTheDocument();
  });

  // ── Amount validation ─────────────────────────────────────────────────────

  it('validates minimum amount', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
        minAmount={5}
      />,
    );
    const amountInput = screen.getByLabelText(/amount|tip/i);
    await user.clear(amountInput);
    await user.type(amountInput, '2');
    expect(screen.getByText(/minimum.*5/i)).toBeInTheDocument();
  });

  it('validates maximum amount', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
        maxAmount={100}
      />,
    );
    const amountInput = screen.getByLabelText(/amount|tip/i);
    await user.clear(amountInput);
    await user.type(amountInput, '150');
    expect(screen.getByText(/maximum.*100/i)).toBeInTheDocument();
  });

  it('rejects invalid number input', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    const amountInput = screen.getByLabelText(/amount|tip/i);
    await user.clear(amountInput);
    await user.type(amountInput, 'invalid');
    expect(screen.getByText(/valid amount/i)).toBeInTheDocument();
  });

  // ── User interactions ─────────────────────────────────────────────────────

  it('calls onSubmit with amount when submit button clicked', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    const submitButton = screen.getByRole('button', { name: /confirm|send|submit/i });
    await user.click(submitButton);
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  it('calls onClose when cancel button clicked', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    const cancelButton = screen.getByRole('button', { name: /cancel|close/i });
    await user.click(cancelButton);
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('closes modal when ESC key is pressed', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    await user.keyboard('{Escape}');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('disables submit button when amount is invalid', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
        minAmount={5}
      />,
    );
    const amountInput = screen.getByLabelText(/amount|tip/i);
    await user.clear(amountInput);
    await user.type(amountInput, '2');
    const submitButton = screen.getByRole('button', { name: /confirm|send|submit/i });
    expect(submitButton).toBeDisabled();
  });

  it('enables submit button when valid amount is entered', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
        minAmount={5}
      />,
    );
    const amountInput = screen.getByLabelText(/amount|tip/i);
    await user.clear(amountInput);
    await user.type(amountInput, '15');
    const submitButton = screen.getByRole('button', { name: /confirm|send|submit/i });
    expect(submitButton).not.toBeDisabled();
  });

  // ── Message field ─────────────────────────────────────────────────────────

  it('includes message in submit data when provided', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    const messageInput = screen.getByPlaceholderText(/message|note/i);
    await user.type(messageInput, 'Great work!');
    const submitButton = screen.getByRole('button', { name: /confirm|send|submit/i });
    await user.click(submitButton);
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Great work!',
      }),
    );
  });

  // ── Loading and error states ──────────────────────────────────────────────

  it('shows loading spinner when isLoading prop is true', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
        isLoading
      />,
    );
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm|send|submit/i })).toBeDisabled();
  });

  it('displays error message when error prop is set', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
        error="Insufficient balance"
      />,
    );
    expect(screen.getByText('Insufficient balance')).toBeInTheDocument();
  });

  // ── Accessibility ────────────────────────────────────────────────────────

  it('has proper ARIA attributes for modal', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
  });

  it('labels all form inputs accessibly', () => {
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    expect(screen.getByLabelText(/amount|tip/i)).toBeInTheDocument();
  });

  it('allows keyboard navigation through form fields', async () => {
    const user = userEvent.setup();
    render(
      <TipModal
        open
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
        workerName="John Doe"
        defaultAmount={10}
      />,
    );
    const amountInput = screen.getByLabelText(/amount|tip/i);
    await user.tab();
    expect(amountInput).toBeFocused();
  });
});
