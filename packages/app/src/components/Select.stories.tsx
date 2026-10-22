import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "@/components/Form";

const meta: Meta<typeof Select> = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

const options = [
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "carpenter", label: "Carpenter" },
];

export const Default: Story = {
  args: { label: "Trade", options },
};

export const Disabled: Story = {
  args: { label: "Trade", options, disabled: true },
};
