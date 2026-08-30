import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import OnboardingModal from '@/components/OnboardingModal'

const meta: Meta<typeof OnboardingModal> = {
  title: 'Components/OnboardingModal',
  component: OnboardingModal,
  tags: ['autodocs'],
  args: {
    // Provide stubs so every story renders without errors.
    onClose: fn(),
    onComplete: fn(),
  },
}
export default meta

type Story = StoryObj<typeof OnboardingModal>

export const Open: Story = {
  args: {
    isOpen: true,
  },
}

export const Closed: Story = {
  args: {
    isOpen: false,
  },
}
