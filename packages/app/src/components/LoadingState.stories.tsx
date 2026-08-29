import type { Meta, StoryObj } from '@storybook/react'
import LoadingState from './LoadingState'

const meta: Meta<typeof LoadingState> = {
  title: 'Components/LoadingState',
  component: LoadingState,
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
  },
}

export const BlockWithMessage: Story = {
  args: {
    variant: 'block',
    message: 'Loading workers…',
  },
}

export const Inline: Story = {
  args: {
    variant: 'inline',
    message: 'Loading more…',
  },
}
