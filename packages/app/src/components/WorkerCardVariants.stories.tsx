import type { Meta, StoryObj } from '@storybook/react'

import { CompactWorkerCard, FeaturedWorkerCard,StandardWorkerCard } from '@/components/WorkerCardVariants'
import type { Worker } from '@/types'

const mockWorker: Worker = {
  id: '1',
  name: 'John Smith',
  category: { id: '1', name: 'Plumber', slug: 'plumber' },
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
  bio: 'Professional plumber with 10 years of experience. Specializing in residential and commercial plumbing.',
  location: 'San Francisco, CA',
  averageRating: 4.8,
  reviewCount: 24,
  isVerified: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const meta: Meta = {
  title: 'Components/WorkerCardVariants',
  tags: ['autodocs'],
}
export default meta

export const Compact: StoryObj = {
  render: () => <CompactWorkerCard worker={mockWorker} />,
}

export const Standard: StoryObj = {
  render: () => <StandardWorkerCard worker={mockWorker} />,
}

export const Featured: StoryObj = {
  render: () => <FeaturedWorkerCard worker={mockWorker} />,
}

export const AllVariants: StoryObj = {
  render: () => (
    <div className="space-y-6 p-6">
      <div>
        <h3 className="text-lg font-semibold mb-3">Compact Variant</h3>
        <CompactWorkerCard worker={mockWorker} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Standard Variant</h3>
        <StandardWorkerCard worker={mockWorker} />
      </div>
      <div>
        <h3 className="text-lg font-semibold mb-3">Featured Variant</h3>
        <FeaturedWorkerCard worker={mockWorker} />
      </div>
    </div>
  ),
}

export const CompactGrid: StoryObj = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <CompactWorkerCard key={i} worker={{ ...mockWorker, id: `${i}`, name: `Worker ${i + 1}` }} />
      ))}
    </div>
  ),
}

export const StandardGrid: StoryObj = {
  render: () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 p-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <StandardWorkerCard key={i} worker={{ ...mockWorker, id: `${i}`, name: `Worker ${i + 1}` }} />
      ))}
    </div>
  ),
}

export const FeaturedGrid: StoryObj = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <FeaturedWorkerCard key={i} worker={{ ...mockWorker, id: `${i}`, name: `Worker ${i + 1}` }} />
      ))}
    </div>
  ),
}
