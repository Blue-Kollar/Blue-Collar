import type { Meta, StoryObj } from '@storybook/react';
import { Select } from '@/components/Form/Select';

const meta: Meta<typeof Select> = {
  title: 'Design System/Select',
  component: Select,
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
  },
};
export default meta;

type Story = StoryObj<typeof Select>;

const options = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'carpenter', label: 'Carpenter' },
];

export const Default: Story = {
  args: {
    label: 'Trade',
    placeholder: 'Choose a trade',
    options,
  },
};

export const Categories: Story = {
  args: {
    label: 'Category',
    placeholder: 'Choose a category',
    options,
  },
};

export const Disabled: Story = {
  args: {
    label: 'Trade',
    placeholder: 'Choose a trade',
    options,
    disabled: true,
  },
};

export const WithValue: Story = {
  args: {
    label: 'Trade',
    options,
    defaultValue: 'electrician',
  },
};

export const Error: Story = {
  args: {
    label: 'Trade',
    placeholder: 'Choose a trade',
    options,
    error: 'Please select a trade.',
  },
};
