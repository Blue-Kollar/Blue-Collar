import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WorkerAnalyticsSummary } from "@/components/Dashboard/WorkerAnalyticsSummary";
import type { PersonalAnalytics } from "@/hooks/useWorkerAnalytics";

vi.mock("lucide-react", () => ({
  Eye: () => <span data-testid="icon-eye" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Wallet: () => <span data-testid="icon-wallet" />,
  Star: () => <span data-testid="icon-star" />,
}));

const mockData: PersonalAnalytics = {
  worker: { id: "w1", name: "Worker 1", category: "Plumbing" },
  range: { startDate: "2026-01-01", endDate: "2026-01-30" },
  summary: {
    totalViews: 1200,
    uniqueViews: 850,
    tipsReceived: 450,
    tipCount: 15,
    avgRating: 4.8,
    reviewCount: 22,
    earnings: 450,
    contacts: 10,
  },
  deltas: {
    totalViews: 12,
    uniqueViews: 8,
    tipsReceived: 15,
    avgRating: 0.2,
    earnings: 15,
  },
  charts: {
    series: [],
    ratingDistribution: [],
  },
};

describe("WorkerAnalyticsSummary", () => {
  it("renders all summary metric cards", () => {
    render(<WorkerAnalyticsSummary data={mockData} />);
    expect(screen.getByText("Profile views")).toBeInTheDocument();
    expect(screen.getByText("1,200")).toBeInTheDocument();

    expect(screen.getByText("Unique views")).toBeInTheDocument();
    expect(screen.getByText("850")).toBeInTheDocument();

    expect(screen.getByText("Tips received")).toBeInTheDocument();
    expect(screen.getByText("450 XLM")).toBeInTheDocument();

    expect(screen.getByText("Avg rating")).toBeInTheDocument();
    expect(screen.getByText("4.8")).toBeInTheDocument();
  });
});
