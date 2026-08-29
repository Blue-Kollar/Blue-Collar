import type { Meta, StoryObj } from '@storybook/react'
import ErrorState from './ErrorState'

const meta: Meta<typeof ErrorState> = {
  title: 'Components/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['inline', 'block'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Block: Story = {
  args: {
    variant: 'block',
    title: 'Something went wrong',
    message: 'Failed to load workers. Please try again.',
    onRetry: () => {},
  },
}

export const BlockWithoutRetry: Story = {
  args: {
    variant: 'block',
    message: 'Failed to load workers.',
  },
}

export const Inline: Story = {
  args: {
    variant: 'inline',
    message: 'Failed to load transactions.',
    onRetry: () => {},
  },
}
