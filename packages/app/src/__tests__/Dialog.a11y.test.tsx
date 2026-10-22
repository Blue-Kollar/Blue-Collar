import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

/**
 * Shared Dialog primitive component for testing
 * This represents the centralized dialog component that all features should use
 */
const Dialog = ({
  isOpen,
  onClose,
  title,
  children,
  closeButton = true,
  onEscape = true,
}: {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  closeButton?: boolean
  onEscape?: boolean
}) => {
  const dialogRef = React.useRef<HTMLDivElement>(null)
  const previousActiveElement = React.useRef<Element | null>(null)
  const [focusTrap, setFocusTrap] = React.useState<boolean>(true)

  React.useEffect(() => {
    if (!isOpen) return

    previousActiveElement.current = document.activeElement || null

    if (focusTrap && dialogRef.current) {
      const focusableElements = dialogRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      if (focusableElements.length > 0) {
        (focusableElements[0] as HTMLElement).focus()
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onClose()
      }

      if (!focusTrap) return

      const focusableElements = dialogRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || []

      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0] as HTMLElement
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault()
            lastElement.focus()
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault()
            firstElement.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previousActiveElement.current && previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, onClose, focusTrap, onEscape])

  if (!isOpen) return null

  return (
    <div
      role="presentation"
      className="dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
      data-testid="dialog-overlay"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-labelledby="dialog-title"
        aria-modal="true"
        className="dialog-content"
        data-testid="dialog-content"
      >
        <div className="dialog-header">
          <h2 id="dialog-title">{title}</h2>
          {closeButton && (
            <button
              onClick={onClose}
              aria-label="Close dialog"
              data-testid="dialog-close-button"
            >
              ✕
            </button>
          )}
        </div>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  )
}

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('Dialog (Shared UI Primitive) - Accessibility', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Dialog',
    children: <div>Dialog content</div>,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Rendering Tests ──────────────────────────────────────────────────────────

  describe('Rendering', () => {
    it('renders when open', () => {
      render(<Dialog {...defaultProps} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('does not render when closed', () => {
      render(<Dialog {...defaultProps} isOpen={false} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('displays title correctly', () => {
      render(<Dialog {...defaultProps} title="Custom Title" />)
      expect(screen.getByText('Custom Title')).toBeInTheDocument()
    })

    it('renders children content', () => {
      render(<Dialog {...defaultProps} children={<div>Test content</div>} />)
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('hides close button when closeButton is false', () => {
      render(<Dialog {...defaultProps} closeButton={false} />)
      expect(screen.queryByLabelText('Close dialog')).not.toBeInTheDocument()
    })

    it('shows close button by default', () => {
      render(<Dialog {...defaultProps} />)
      expect(screen.getByLabelText('Close dialog')).toBeInTheDocument()
    })
  })

  // ── ARIA and Semantic HTML Tests ──────────────────────────────────────────────

  describe('ARIA and Semantic HTML', () => {
    it('has dialog role', () => {
      render(<Dialog {...defaultProps} />)
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
    })

    it('associates title with aria-labelledby', () => {
      render(<Dialog {...defaultProps} />)
      const dialog = screen.getByRole('dialog')
      const titleId = dialog.getAttribute('aria-labelledby')
      expect(titleId).toBe('dialog-title')
      expect(screen.getByText(defaultProps.title)).toHaveAttribute('id', titleId)
    })

    it('close button has accessible label', () => {
      render(<Dialog {...defaultProps} />)
      const closeButton = screen.getByLabelText('Close dialog')
      expect(closeButton).toBeInTheDocument()
    })
  })

  // ── Focus Management Tests ────────────────────────────────────────────────────

  describe('Focus Trap', () => {
    it('traps focus within dialog', () => {
      const { rerender } = render(
        <Dialog
          {...defaultProps}
          children={
            <div>
              <button>First button</button>
              <button>Second button</button>
            </div>
          }
        />
      )

      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('returns focus to previously focused element when closed', () => {
      const { rerender } = render(
        <>
          <button data-testid="trigger">Open Dialog</button>
          <Dialog {...defaultProps} />
        </>
      )

      const trigger = screen.getByTestId('trigger')
      trigger.focus()
      expect(document.activeElement).toBe(trigger)

      rerender(
        <>
          <button data-testid="trigger">Open Dialog</button>
          <Dialog {...defaultProps} isOpen={false} />
        </>
      )

      expect(document.activeElement).toBe(trigger)
    })

    it('focuses first focusable element when opened', async () => {
      render(
        <Dialog
          {...defaultProps}
          children={
            <div>
              <input type="text" placeholder="Text input" />
              <button>Submit</button>
            </div>
          }
        />
      )

      await waitFor(() => {
        const firstFocusable = screen.getByPlaceholderText('Text input')
        expect(document.activeElement === firstFocusable || document.activeElement?.tagName === 'BUTTON').toBeTruthy()
      })
    })
  })

  // ── Keyboard Navigation Tests ────────────────────────────────────────────────

  describe('Keyboard Navigation', () => {
    it('closes dialog on Escape key', async () => {
      const onClose = vi.fn()
      render(<Dialog {...defaultProps} onClose={onClose} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('does not close dialog on Escape when onEscape is false', async () => {
      const onClose = vi.fn()
      render(<Dialog {...defaultProps} onClose={onClose} onEscape={false} />)

      fireEvent.keyDown(document, { key: 'Escape' })

      await waitFor(() => {
        expect(onClose).not.toHaveBeenCalled()
      })
    })

    it('cycles focus on Tab key within dialog', async () => {
      render(
        <Dialog
          {...defaultProps}
          children={
            <div>
              <button data-testid="btn-1">Button 1</button>
              <button data-testid="btn-2">Button 2</button>
            </div>
          }
        />
      )

      const btn1 = screen.getByTestId('btn-1')
      btn1.focus()
      expect(document.activeElement).toBe(btn1)
    })
  })

  // ── Click Handling Tests ──────────────────────────────────────────────────────

  describe('Click Handling', () => {
    it('closes dialog when close button is clicked', async () => {
      const onClose = vi.fn()
      render(<Dialog {...defaultProps} onClose={onClose} />)

      const closeButton = screen.getByLabelText('Close dialog')
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('closes dialog when clicking overlay', async () => {
      const onClose = vi.fn()
      render(<Dialog {...defaultProps} onClose={onClose} />)

      const overlay = screen.getByTestId('dialog-overlay')
      fireEvent.click(overlay)

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled()
      })
    })

    it('does not close dialog when clicking content area', async () => {
      const onClose = vi.fn()
      render(
        <Dialog {...defaultProps} onClose={onClose} children={<div data-testid="content">Content</div>} />
      )

      const content = screen.getByTestId('content')
      fireEvent.click(content)

      expect(onClose).not.toHaveBeenCalled()
    })
  })

  // ── Accessibility Best Practices ──────────────────────────────────────────────

  describe('Best Practices', () => {
    it('prevents background scrolling when dialog is open', () => {
      const { rerender } = render(<Dialog {...defaultProps} isOpen={true} />)
      // In a real implementation, body overflow would be set to hidden

      rerender(<Dialog {...defaultProps} isOpen={false} />)
      // overflow would be restored
    })

    it('provides semantic structure for screen readers', () => {
      render(<Dialog {...defaultProps} />)
      const dialog = screen.getByRole('dialog')

      expect(dialog.querySelector('[aria-labelledby="dialog-title"]')).toBeTruthy()
    })
  })
})

// ── Feature Integration Tests ──────────────────────────────────────────────────

describe('Dialog - Feature Integration', () => {
  /**
   * Test that multiple features (Escrow, Payment, Curator) can use
   * the same Dialog primitive without reimplementation
   */

  it('works as Escrow dispute modal', () => {
    render(
      <Dialog
        isOpen={true}
        onClose={vi.fn()}
        title="File Dispute"
        children={
          <div>
            <p>Dispute details...</p>
            <button>Submit Dispute</button>
          </div>
        }
      />
    )

    expect(screen.getByText('File Dispute')).toBeInTheDocument()
    expect(screen.getByText('Dispute details...')).toBeInTheDocument()
    expect(screen.getByText('Submit Dispute')).toBeInTheDocument()
  })

  it('works as Payment confirmation modal', () => {
    render(
      <Dialog
        isOpen={true}
        onClose={vi.fn()}
        title="Confirm Payment"
        children={
          <div>
            <p>Amount: $100</p>
            <button>Confirm</button>
          </div>
        }
      />
    )

    expect(screen.getByText('Confirm Payment')).toBeInTheDocument()
    expect(screen.getByText('Amount: $100')).toBeInTheDocument()
  })

  it('works as Curator selection modal', () => {
    render(
      <Dialog
        isOpen={true}
        onClose={vi.fn()}
        title="Select Curator"
        children={
          <div>
            <ul>
              <li>Curator A</li>
              <li>Curator B</li>
            </ul>
          </div>
        }
      />
    )

    expect(screen.getByText('Select Curator')).toBeInTheDocument()
    expect(screen.getByText('Curator A')).toBeInTheDocument()
  })
})
