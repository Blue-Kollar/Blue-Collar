import type { Meta, StoryObj } from '@storybook/react';
import { Input } from '@/components/ui/input';

const meta: Meta<typeof Input> = {
  title: 'Design System/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search'],
    },
    disabled: { control: 'boolean' },
    placeholder: { control: 'text' },
  },
};
export default meta;

type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'Enter email...',
  },
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: 'Enter password...',
  },
};

export const Search: Story = {
  args: {
    type: 'search',
    placeholder: 'Search workers...',
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
};

export const Error: Story = {
  render: () => (
    <div className="w-full max-w-sm space-y-2">
      <label htmlFor="email-error" className="text-sm font-medium">
        Email
      </label>
      <Input
        id="email-error"
        type="email"
        defaultValue="not-an-email"
        aria-invalid="true"
        aria-describedby="email-error-message"
        className="border-destructive focus-visible:ring-destructive"
      />
      <p id="email-error-message" className="text-sm text-destructive">
        Enter a valid email address.
      </p>
    </div>
  ),
};

export const WithValue: Story = {
  args: {
    placeholder: 'Enter text...',
    defaultValue: 'Sample value',
  },
};
