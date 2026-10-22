import type { Meta, StoryObj } from '@storybook/react'
import { CategoryBadge } from './CategoryBadge'

const meta: Meta<typeof CategoryBadge> = {
  title: 'Components/CategoryBadge',
  component: CategoryBadge,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Plumber: Story = {
  args: {
    slug: 'plumber',
  },
}

export const Electrician: Story = {
  args: {
    slug: 'electrician',
  },
}

export const Carpenter: Story = {
  args: {
    slug: 'carpenter',
  },
}

export const Welder: Story = {
  args: {
    category: { id: '4', name: 'Welder' },
  },
}
