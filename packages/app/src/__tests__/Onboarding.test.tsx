/**
 * Behaviour guard for the onboarding components after the dead-code cleanup
 * (issue #966). These assert the surviving public surface still works, so a
 * future removal of "unused" code cannot silently break the flows.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const TOUR_KEY = 'bc_tour_done'

describe('OnboardingTour', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows on first visit and walks forward through every step', async () => {
    const user = userEvent.setup()
    const { default: OnboardingTour } = await import('@/components/OnboardingTour')
    render(<OnboardingTour />)

    expect(screen.getByRole('dialog', { name: /onboarding tour/i })).toBeInTheDocument()
    expect(screen.getByText('Find skilled workers')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Save your favourites')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText('Leave a review')).toBeInTheDocument()

    // Last step swaps "Next" for the closing CTA.
    expect(screen.queryByRole('button', { name: /^next$/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  it('jumps to a step via the dot controls and disables Back on the first step', async () => {
    const user = userEvent.setup()
    const { default: OnboardingTour } = await import('@/components/OnboardingTour')
    render(<OnboardingTour />)

    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Go to step 3' }))
    expect(screen.getByText('Pay with Stellar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByText('Save your favourites')).toBeInTheDocument()
  })

  it('persists dismissal so it does not reappear on the next mount', async () => {
    const user = userEvent.setup()
    const { default: OnboardingTour } = await import('@/components/OnboardingTour')
    const { unmount } = render(<OnboardingTour />)

    // Two controls share the "Skip tour" name: the header close icon and the
    // footer text link. The footer link is the last one in DOM order.
    const skipControls = screen.getAllByRole('button', { name: /skip tour/i })
    await user.click(skipControls[skipControls.length - 1]!)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(localStorage.getItem(TOUR_KEY)).toBe('1')

    unmount()
    render(<OnboardingTour />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('OnboardingModal', () => {
  const props = () => ({
    isOpen: true,
    onClose: vi.fn(),
    onComplete: vi.fn(),
  })

  it('renders nothing when closed', async () => {
    const { default: OnboardingModal } = await import('@/components/OnboardingModal')
    const { container } = render(<OnboardingModal {...props()} isOpen={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('advances through steps and completes on the final action', async () => {
    const user = userEvent.setup()
    const p = props()
    const { default: OnboardingModal } = await import('@/components/OnboardingModal')
    render(<OnboardingModal {...p} />)

    expect(screen.getByText('Complete Your Profile')).toBeInTheDocument()
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /go to profile/i }))
    await user.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /browse workers/i }))
    expect(p.onComplete).toHaveBeenCalledTimes(1)
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })

  it('skipping completes and closes without advancing', async () => {
    const user = userEvent.setup()
    const p = props()
    const { default: OnboardingModal } = await import('@/components/OnboardingModal')
    render(<OnboardingModal {...p} />)

    await user.click(screen.getByRole('button', { name: /skip for now/i }))
    expect(p.onComplete).toHaveBeenCalledTimes(1)
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })
})
