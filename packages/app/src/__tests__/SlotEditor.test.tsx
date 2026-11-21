/**
 * SlotEditor.test.tsx
 * Closes #1567 — unit tests for slot selection in SlotEditor
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { screen, fireEvent, cleanup } from "@testing-library/react";
import { renderWithIntl as render } from "@/__tests__/renderWithIntl";
import SlotEditor from "@/components/AvailabilityCalendar/SlotEditor";

afterEach(cleanup);

function renderEditor(overrides: Partial<Parameters<typeof SlotEditor>[0]> = {}) {
  const props = {
    availability: [],
    showSlotEditor: true,
    bulkDays: [],
    bulkStart: "09:00",
    bulkEnd: "17:00",
    onToggleEditor: vi.fn(),
    onToggleBulkDay: vi.fn(),
    onBulkApply: vi.fn(),
    onStartTimeChange: vi.fn(),
    onEndTimeChange: vi.fn(),
    onSelectWeekdays: vi.fn(),
    onSelectAll: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<SlotEditor {...props} />);
  return props;
}

describe("SlotEditor — day selection", () => {
  it("calls onToggleBulkDay with the day index when a day button is clicked", () => {
    const props = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Mo" }));
    fireEvent.click(screen.getByRole("button", { name: "Sa" }));

    expect(props.onToggleBulkDay).toHaveBeenNthCalledWith(1, 1);
    expect(props.onToggleBulkDay).toHaveBeenNthCalledWith(2, 6);
  });

  it("marks only the selected days as active", () => {
    renderEditor({ bulkDays: [2, 4] });

    expect(screen.getByRole("button", { name: "Tu" }).className).toContain("bg-blue-600");
    expect(screen.getByRole("button", { name: "Th" }).className).toContain("bg-blue-600");
    expect(screen.getByRole("button", { name: "Mo" }).className).not.toContain("bg-blue-600");
  });

  it("forwards the Weekdays and All shortcuts", () => {
    const props = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Weekdays" }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    expect(props.onSelectWeekdays).toHaveBeenCalledTimes(1);
    expect(props.onSelectAll).toHaveBeenCalledTimes(1);
  });
});

describe("SlotEditor — apply button", () => {
  it("is disabled and reports zero days when nothing is selected", () => {
    renderEditor({ bulkDays: [] });

    const apply = screen.getByRole("button", { name: "Apply to 0 days" });
    expect(apply).toBeDisabled();
  });

  it("uses singular wording for exactly one selected day", () => {
    renderEditor({ bulkDays: [3] });

    expect(screen.getByRole("button", { name: "Apply to 1 day" })).toBeEnabled();
  });

  it("uses plural wording and calls onBulkApply for several selected days", () => {
    const props = renderEditor({ bulkDays: [1, 2, 3] });

    const apply = screen.getByRole("button", { name: "Apply to 3 days" });
    fireEvent.click(apply);

    expect(props.onBulkApply).toHaveBeenCalledTimes(1);
  });
});

describe("SlotEditor — editor visibility", () => {
  it("shows the Set availability toggle when the editor is closed", () => {
    const props = renderEditor({ showSlotEditor: false });

    expect(screen.queryByText("Bulk set availability")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Set availability/ }));

    expect(props.onToggleEditor).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleEditor from the Cancel button when the editor is open", () => {
    const props = renderEditor({ showSlotEditor: true });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(props.onToggleEditor).toHaveBeenCalledTimes(1);
  });
});

describe("SlotEditor — current schedule", () => {
  it("calls onRemove with the slot's day of week", () => {
    const props = renderEditor({
      availability: [{ dayOfWeek: 5, startTime: "08:00", endTime: "12:00" }],
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Friday" }));

    expect(props.onRemove).toHaveBeenCalledWith(5);
  });
});
