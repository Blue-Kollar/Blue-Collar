import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkerAnalyticsFilters } from "@/components/Dashboard/WorkerAnalyticsFilters";

const mockWorkers = [
  { id: "w1", name: "Worker One", isActive: true, category: { id: "c1", name: "Plumbing" } },
  { id: "w2", name: "Worker Two", isActive: false, category: { id: "c2", name: "Carpentry" } },
];

describe("WorkerAnalyticsFilters", () => {
  it("renders worker select options and date inputs", () => {
    render(
      <WorkerAnalyticsFilters
        workers={mockWorkers}
        selectedWorkerId="w1"
        onWorkerChange={() => {}}
        startDate="2026-01-01"
        onStartDateChange={() => {}}
        endDate="2026-01-30"
        onEndDateChange={() => {}}
        preset="30"
        onPresetChange={() => {}}
      />
    );

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

    render(
      <WorkerAnalyticsFilters
        workers={mockWorkers}
        selectedWorkerId="w1"
        onWorkerChange={onWorkerChange}
        startDate="2026-01-01"
        onStartDateChange={() => {}}
        endDate="2026-01-30"
        onEndDateChange={() => {}}
        preset="30"
        onPresetChange={onPresetChange}
      />
    );

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "w2" } });
    expect(onWorkerChange).toHaveBeenCalledWith("w2");

    fireEvent.click(screen.getByText("7D"));
    expect(onPresetChange).toHaveBeenCalledWith("7");
  });
});
