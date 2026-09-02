import type { Meta, StoryObj } from '@storybook/react'

import CategoryBadge from './CategoryBadge'

const meta: Meta<typeof CategoryBadge> = {
  title: 'Components/CategoryBadge',
  component: CategoryBadge,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Plumber: Story = {
  args: {
    category: { id: '1', name: 'Plumber' },
  },
}

export const Electrician: Story = {
  args: {
    category: { id: '2', name: 'Electrician' },
  },
}

export const Carpenter: Story = {
  args: {
    category: { id: '3', name: 'Carpenter' },
  },
}

export const Welder: Story = {
  args: {
    category: { id: '4', name: 'Welder' },
  },
}
