import { screen } from "@testing-library/react";
import { renderWithIntl as render } from "@/__tests__/renderWithIntl";
import { describe, it, expect, vi } from "vitest";
import { WorkerAnalyticsSummary } from "@/components/Dashboard/WorkerAnalyticsSummary";
import type { PersonalAnalytics } from "@/hooks/useWorkerAnalytics";

vi.mock("lucide-react", () => ({
  Eye: () => <span data-testid="icon-eye" />,
  TrendingUp: () => <span data-testid="icon-trending" />,
  Wallet: () => <span data-testid="icon-wallet" />,
  Star: () => <span data-testid="icon-star" />,
}));

function buildData(overrides: {
  summary?: Partial<PersonalAnalytics["summary"]>;
  deltas?: Partial<PersonalAnalytics["deltas"]>;
} = {}): PersonalAnalytics {
  return {
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
      ...overrides.summary,
    },
    deltas: {
      totalViews: 12,
      uniqueViews: 8,
      tipsReceived: 15,
      avgRating: 0.2,
      earnings: 15,
      ...overrides.deltas,
    },
    charts: {
      series: [],
      ratingDistribution: [],
    },
  };
}

const mockData = buildData();

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

  it("shows zero values and a dash rating when there are no records", () => {
    const empty = buildData({
      summary: {
        totalViews: 0,
        uniqueViews: 0,
        tipsReceived: 0,
        tipCount: 0,
        avgRating: 0,
        reviewCount: 0,
      },
      deltas: { totalViews: 0, uniqueViews: 0, tipsReceived: 0, avgRating: 0, earnings: 0 },
    });
    render(<WorkerAnalyticsSummary data={empty} />);

    expect(screen.getByText("0 XLM")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText(/0 tips/)).toBeInTheDocument();
    expect(screen.getByText(/0 reviews/)).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it("renders a single record's counts without grouping separators", () => {
    const single = buildData({
      summary: {
        totalViews: 1,
        uniqueViews: 1,
        tipsReceived: 5,
        tipCount: 1,
        avgRating: 5,
        reviewCount: 1,
      },
    });
    render(<WorkerAnalyticsSummary data={single} />);

    expect(screen.getByText("5 XLM")).toBeInTheDocument();
    expect(screen.getByText(/1 tips/)).toBeInTheDocument();
    expect(screen.getByText("5.0")).toBeInTheDocument();
    expect(screen.getByText(/1 reviews/)).toBeInTheDocument();
  });

  it("formats large totals with separators and signs positive deltas", () => {
    const many = buildData({
      summary: {
        totalViews: 1234567,
        uniqueViews: 987654,
        tipsReceived: 98765.4321,
        tipCount: 4321,
        reviewCount: 500,
      },
    });
    render(<WorkerAnalyticsSummary data={many} />);

    expect(screen.getByText("1,234,567")).toBeInTheDocument();
    expect(screen.getByText("987,654")).toBeInTheDocument();
    expect(screen.getByText("98,765.43 XLM")).toBeInTheDocument();
    expect(screen.getByText(/\+15% vs previous period · 4321 tips/)).toBeInTheDocument();
    expect(screen.getByText(/\+12% vs previous period$/)).toBeInTheDocument();
  });

  it("colours negative deltas red and renders them without a plus sign", () => {
    const declining = buildData({
      deltas: { totalViews: -7, uniqueViews: -3, tipsReceived: -10, avgRating: -0.5, earnings: -10 },
    });
    render(<WorkerAnalyticsSummary data={declining} />);

    const viewsDelta = screen.getByText(/-7% vs previous period/);
    expect(viewsDelta.className).toContain("text-red-600");
    expect(viewsDelta.textContent).not.toMatch(/^\+/);

    const ratingDelta = screen.getByText(/-0\.5 vs previous period/);
    expect(ratingDelta.className).toContain("text-red-600");
  });
});
