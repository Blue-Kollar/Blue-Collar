import type { Meta, StoryObj } from '@storybook/react'

import EmptyStateWithIllustration from '@/components/EmptyStateWithIllustration'

const meta: Meta<typeof EmptyStateWithIllustration> = {
  title: 'Components/EmptyStateWithIllustration',
  component: EmptyStateWithIllustration,
  tags: ['autodocs'],
}
export default meta

type Story = StoryObj<typeof EmptyStateWithIllustration>

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

export const AllVariants: Story = {
  render: () => (
    <div className="space-y-8 p-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">No Workers</h3>
        <EmptyStateWithIllustration variant="no-workers" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">No Bookmarks</h3>
        <EmptyStateWithIllustration variant="no-bookmarks" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">No Reviews</h3>
        <EmptyStateWithIllustration variant="no-reviews" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">No Search Results</h3>
        <EmptyStateWithIllustration variant="no-search-results" />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-4">No Transactions</h3>
        <EmptyStateWithIllustration variant="no-transactions" />
      </div>
    </div>
  ),
}
