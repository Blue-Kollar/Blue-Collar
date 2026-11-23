import type { Meta, StoryObj } from '@storybook/react';

const Skeleton = ({ width = 'w-full', height = 'h-4', className = '' }: any) => (
  <div className={`${width} ${height} bg-gray-200 rounded animate-pulse ${className}`} />
);

const meta: Meta<typeof Skeleton> = {
  title: 'Components/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    width: 'w-full',
    height: 'h-4',
  },
};

export const Card: Story = {
  render: () => (
    <div className="space-y-4 p-4 border rounded-lg">
      <Skeleton height="h-12 w-12 rounded-full" />
      <Skeleton height="h-4" />
      <Skeleton height="h-4 w-3/4" />
      <Skeleton height="h-8 w-1/3" />
    </div>
  ),
};

export const Avatar: Story = {
  args: {
    width: 'w-12',
    height: 'h-12',
    className: 'rounded-full',
  },
};
