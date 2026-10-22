import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DashboardTabs } from "@/components/Dashboard/DashboardTabs";

vi.mock("lucide-react", () => ({
  BarChart3: () => <span data-testid="icon-barchart" />,
}));

describe("DashboardTabs", () => {
  it("renders both tabs", () => {
    render(<DashboardTabs activeTab="workers" onTabChange={() => {}} />);
    expect(screen.getByText("Workers")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
  });

  it("calls onTabChange when clicked", () => {
    const onTabChange = vi.fn();
    render(<DashboardTabs activeTab="workers" onTabChange={onTabChange} />);
    fireEvent.click(screen.getByText("Analytics"));
    expect(onTabChange).toHaveBeenCalledWith("analytics");

    fireEvent.click(screen.getByText("Workers"));
    expect(onTabChange).toHaveBeenCalledWith("workers");
  });
});
