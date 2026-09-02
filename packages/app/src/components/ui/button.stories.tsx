import type { Meta, StoryObj } from '@storybook/react'

import { Button } from '@/components/ui/button'

const meta: Meta<typeof Button> = {
  title: 'Design System/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'],
    },
    size: { control: 'select', options: ['default', 'sm', 'lg', 'icon'] },
  },
}
export default meta

type Story = StoryObj<typeof Button>

export const Primary: Story = { args: { children: 'Primary Button' } }
export const Secondary: Story = { args: { variant: 'secondary', children: 'Secondary' } }
export const Outline: Story = { args: { variant: 'outline', children: 'Outline' } }
export const Destructive: Story = { args: { variant: 'destructive', children: 'Delete' } }
export const Small: Story = { args: { size: 'sm', children: 'Small' } }
export const Large: Story = { args: { size: 'lg', children: 'Large' } }
export const Disabled: Story = { args: { disabled: true, children: 'Disabled' } }
