import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "./Checkbox";
import { DatePicker } from "./DatePicker";
import { FileUpload } from "./FileUpload";
import { Input } from "./Input";
import { RadioGroup } from "./Radio";
import { Select } from "./Select";

// ─── Input ────────────────────────────────────────────────────────────────────

const inputMeta: Meta<typeof Input> = {
  title: "Form/Input",
  component: Input,
  tags: ["autodocs"],
};
export default inputMeta;
type InputStory = StoryObj<typeof Input>;

export const Default: InputStory = { args: { label: "Name", placeholder: "John Doe" } };
export const WithHint: InputStory = { args: { label: "Email", type: "email", hint: "We'll never share your email." } };
export const WithError: InputStory = { args: { label: "Email", type: "email", value: "bad", error: "Invalid email address." } };
export const Disabled: InputStory = { args: { label: "Username", value: "jdoe", disabled: true } };

// ─── Select ───────────────────────────────────────────────────────────────────

export const SelectDefault: StoryObj<typeof Select> = {
  render: () => (
    <Select
      label="Category"
      placeholder="Pick a category"
      options={[
        { label: "Plumber", value: "plumber" },
        { label: "Electrician", value: "electrician" },
      ]}
    />
  ),
};

export const SelectError: StoryObj<typeof Select> = {
  render: () => (
    <Select
      label="Category"
      placeholder="Pick a category"
      options={[{ label: "Plumber", value: "plumber" }]}
      error="Please select a category."
    />
  ),
};

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export const CheckboxDefault: StoryObj<typeof Checkbox> = {
  render: () => <Checkbox label="I agree to the terms" />,
};
export const CheckboxChecked: StoryObj<typeof Checkbox> = {
  render: () => <Checkbox label="Receive notifications" defaultChecked />,
};
export const CheckboxError: StoryObj<typeof Checkbox> = {
  render: () => <Checkbox label="I agree to the terms" error="You must accept the terms." />,
};

// ─── RadioGroup ───────────────────────────────────────────────────────────────

export const RadioDefault: StoryObj<typeof RadioGroup> = {
  render: () => (
    <RadioGroup
      label="Role"
      name="role"
      options={[
        { label: "User", value: "user" },
        { label: "Curator", value: "curator" },
      ]}
    />
  ),
};

// ─── DatePicker ───────────────────────────────────────────────────────────────

export const DatePickerDefault: StoryObj<typeof DatePicker> = {
  render: () => <DatePicker label="Start date" />,
};
export const DatePickerError: StoryObj<typeof DatePicker> = {
  render: () => <DatePicker label="Start date" error="Date is required." />,
};

// ─── FileUpload ───────────────────────────────────────────────────────────────

export const FileUploadDefault: StoryObj<typeof FileUpload> = {
  render: () => <FileUpload label="Profile image" accept="image/*" hint="PNG, JPG up to 5 MB" />,
};
export const FileUploadError: StoryObj<typeof FileUpload> = {
  render: () => <FileUpload label="Profile image" accept="image/*" error="Image is required." />,
};
