import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import ContractSummary from "@/components/ContractSummary";
import type { TipDTO } from "@/types";

vi.mock("lucide-react", () => ({
  DollarSign: () => <span data-testid="dollar-icon" />,
  Calendar: () => <span data-testid="calendar-icon" />,
  TrendingUp: () => <span data-testid="trending-icon" />,
}));

const baseTip: TipDTO = {
  id: "tip1",
  amount: "50.00",
  workerId: "w1",
  senderId: "user1",
  memo: "Great work!",
  createdAt: "2026-07-25T10:00:00Z",
};

describe("ContractSummary", () => {
  it("renders tip amount correctly", () => {
    render(<ContractSummary tip={baseTip} />);
    expect(screen.getByText("50.00 XLM")).toBeInTheDocument();
  });

  it("displays formatted date", () => {
    render(<ContractSummary tip={baseTip} />);
    expect(screen.getByText(/Jul 25, 2026/)).toBeInTheDocument();
  });

  it("shows memo when provided", () => {
    render(<ContractSummary tip={baseTip} />);
    expect(screen.getByText("Great work!")).toBeInTheDocument();
  });

  it("does not show memo when not provided", () => {
    const tipWithoutMemo: TipDTO = {
      ...baseTip,
      memo: "",
    };
    render(<ContractSummary tip={tipWithoutMemo} />);
    expect(screen.queryByText("Great work!")).not.toBeInTheDocument();
  });

  it("displays confirmed status", () => {
    render(<ContractSummary tip={baseTip} />);
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
  });

  it("renders loading state", () => {
    const { container } = render(<ContractSummary tip={baseTip} isLoading />);
    const skeletonElements = container.querySelectorAll(".animate-pulse");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it("renders all required icons", () => {
    render(<ContractSummary tip={baseTip} />);
    expect(screen.getByTestId("dollar-icon")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    expect(screen.getByTestId("trending-icon")).toBeInTheDocument();
  });

  it("handles large tip amounts", () => {
    const largeTip: TipDTO = {
      ...baseTip,
      amount: "9999.99",
    };
    render(<ContractSummary tip={largeTip} />);
    expect(screen.getByText("9999.99 XLM")).toBeInTheDocument();
  });

  it("handles decimal amounts correctly", () => {
    const decimalTip: TipDTO = {
      ...baseTip,
      amount: "0.50",
    };
    render(<ContractSummary tip={decimalTip} />);
    expect(screen.getByText("0.50 XLM")).toBeInTheDocument();
  });
});
