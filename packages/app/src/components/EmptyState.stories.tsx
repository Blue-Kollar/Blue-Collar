import type { Meta, StoryObj } from '@storybook/react'

import EmptyState from './EmptyState'

const meta: Meta<typeof EmptyState> = {
  title: 'Components/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['no-workers', 'no-bookmarks', 'no-reviews', 'no-search-results', 'no-transactions'],
    },
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const NoWorkers: Story = {
  args: {
    variant: 'no-workers',
  },
}

export const NoBookmarks: Story = {
  args: {
    variant: 'no-bookmarks',
  },
}

export const NoReviews: Story = {
  args: {
    variant: 'no-reviews',
  },
}

export const NoSearchResults: Story = {
  args: {
    variant: 'no-search-results',
  },
}

export const NoTransactions: Story = {
  args: {
    variant: 'no-transactions',
  },
}

export const CustomCTA: Story = {
  args: {
    variant: 'no-workers',
    ctaText: 'Create First Listing',
    ctaHref: '/dashboard/create',
  },
}
