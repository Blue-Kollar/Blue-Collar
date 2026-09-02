import type { Meta, StoryObj } from '@storybook/react'

import { Badge } from '@/components/ui/badge'

const meta: Meta<typeof Badge> = {
  title: 'Design System/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'secondary', 'destructive', 'outline'],
    },
  },
}
export default meta

type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { children: 'Plumber' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Curator' } }
export const Destructive: Story = { args: { variant: 'destructive', children: 'Inactive' } }
export const Outline: Story = { args: { variant: 'outline', children: 'Verified' } }
