import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkerAnalyticsFilters } from "@/components/Dashboard/WorkerAnalyticsFilters";

const mockWorkers = [
  { id: "w1", name: "Worker One", isActive: true, category: { id: "c1", name: "Plumbing" } },
  { id: "w2", name: "Worker Two", isActive: false, category: { id: "c2", name: "Carpentry" } },
];

function renderFilters(overrides: Partial<React.ComponentProps<typeof WorkerAnalyticsFilters>> = {}) {
  const props = {
    workers: mockWorkers,
    selectedWorkerId: "w1",
    onWorkerChange: vi.fn(),
    startDate: "2026-01-01",
    onStartDateChange: vi.fn(),
    endDate: "2026-01-30",
    onEndDateChange: vi.fn(),
    preset: "30" as const,
    onPresetChange: vi.fn(),
    ...overrides,
  };
  render(<WorkerAnalyticsFilters {...props} />);
  return props;
}

describe("WorkerAnalyticsFilters", () => {
  it("renders worker select options and date inputs", () => {
    renderFilters();

    expect(screen.getByText("Worker One")).toBeInTheDocument();
    expect(screen.getByText("Worker Two")).toBeInTheDocument();
    expect(screen.getByText("7D")).toBeInTheDocument();
    expect(screen.getByText("30D")).toBeInTheDocument();
    expect(screen.getByText("90D")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("handles changes to worker and presets", () => {
    const onWorkerChange = vi.fn();
    const onPresetChange = vi.fn();

    renderFilters({ onWorkerChange, onPresetChange });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "w2" } });
    expect(onWorkerChange).toHaveBeenCalledWith("w2");

    fireEvent.click(screen.getByText("7D"));
    expect(onPresetChange).toHaveBeenCalledWith("7");
  });

  it("reports the selected worker as the current select value", () => {
    renderFilters({ selectedWorkerId: "w2" });
    expect(screen.getByRole("combobox")).toHaveValue("w2");
  });

  it("emits the new start and end dates when either input changes", () => {
    const onStartDateChange = vi.fn();
    const onEndDateChange = vi.fn();
    renderFilters({ onStartDateChange, onEndDateChange });

    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2026-02-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2026-02-28" } });

    expect(onStartDateChange).toHaveBeenCalledWith("2026-02-01");
    expect(onEndDateChange).toHaveBeenCalledWith("2026-02-28");
  });

  it("emits 'custom' when the Custom preset is clicked", () => {
    const onPresetChange = vi.fn();
    renderFilters({ onPresetChange });

    fireEvent.click(screen.getByText("Custom"));
    expect(onPresetChange).toHaveBeenCalledWith("custom");
  });

  it("highlights only the active preset", () => {
    renderFilters({ preset: "90" });

    expect(screen.getByText("90D").className).toContain("bg-white");
    expect(screen.getByText("7D").className).not.toContain("bg-white");
    expect(screen.getByText("30D").className).not.toContain("bg-white");
    expect(screen.getByText("Custom").className).not.toContain("bg-white");
  });
});
