import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

const Modal = ({ isOpen, onClose, title, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

const ModalDemo = (props: any) => {
  const [isOpen, setIsOpen] = useState(props.isOpen ?? true);
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded-md"
      >
        Open Modal
      </button>
      <Modal {...props} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

const meta: Meta<typeof ModalDemo> = {
  title: 'Components/Modal',
  component: ModalDemo,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: 'Confirm Action',
    children: 'Are you sure you want to proceed?',
  },
};

export const WithForm: Story = {
  args: {
    title: 'Edit Profile',
    children: (
      <form className="space-y-4">
        <input placeholder="Name" className="w-full px-3 py-2 border rounded-md" />
        <input placeholder="Email" className="w-full px-3 py-2 border rounded-md" />
        <button className="w-full px-4 py-2 bg-blue-600 text-white rounded-md">Save</button>
      </form>
    ),
  },
};
