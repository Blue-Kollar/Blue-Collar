import { render } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { UserGrowthChart, WorkerGrowthChart, TopCategoriesChart } from "../AdminCharts";
import { ViewTrendsChart, WorkersBarChart } from "../CuratorCharts";

// Mock recharts components to avoid complex setup
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: any) => (
    <div data-testid="responsive-container">{children}</div>
  ),
  LineChart: ({ data }: any) => (
    <div data-testid="line-chart" data-items={data?.length || 0} />
  ),
  BarChart: ({ data }: any) => (
    <div data-testid="bar-chart" data-items={data?.length || 0} />
  ),
  Line: ({ dataKey, stroke, strokeWidth }: any) => (
    <div data-testid="line" data-key={dataKey} data-stroke={stroke} data-width={strokeWidth} />
  ),
  Bar: ({ dataKey, fill }: any) => (
    <div data-testid="bar" data-key={dataKey} data-fill={fill} />
  ),
  XAxis: ({ dataKey }: any) => <div data-testid="x-axis" data-key={dataKey} />,
  YAxis: () => <div data-testid="y-axis" />,
  CartesianGrid: () => <div data-testid="grid" />,
  Tooltip: ({ labelFormatter }: any) => (
    <div data-testid="tooltip" data-has-formatter={!!labelFormatter} />
  ),
}));

describe("Chart Components - Issue #1378", () => {
  describe("Admin Charts", () => {
    const mockTrendData = [
      { month: "January", count: 10 },
      { month: "February", count: 15 },
      { month: "March", count: 20 },
    ];

    const mockCategoryData = [
      { name: "Construction", count: 45 },
      { name: "Plumbing", count: 32 },
      { name: "Electrical", count: 28 },
    ];

    describe("UserGrowthChart", () => {
      it("should render line chart with user growth data", () => {
        const { getByTestId, getByText } = render(
          <UserGrowthChart data={mockTrendData} />
        );

        expect(getByTestId("line-chart")).toBeInTheDocument();
        expect(getByTestId("responsive-container")).toBeInTheDocument();
      });

      it("should render with correct height", () => {
        const { container } = render(
          <UserGrowthChart data={mockTrendData} />
        );

        expect(container.querySelector('[data-testid="responsive-container"]')).toBeInTheDocument();
      });

      it("should pass correct data to line chart", () => {
        const { getByTestId } = render(
          <UserGrowthChart data={mockTrendData} />
        );

        const chart = getByTestId("line-chart");
        expect(chart).toHaveAttribute("data-items", "3");
      });

      it("should display user growth metrics", () => {
        const { getByTestId } = render(
          <UserGrowthChart data={mockTrendData} />
        );

        expect(getByTestId("x-axis")).toBeInTheDocument();
        expect(getByTestId("y-axis")).toBeInTheDocument();
        expect(getByTestId("grid")).toBeInTheDocument();
      });

      it("should render line with correct styling", () => {
        const { getByTestId } = render(
          <UserGrowthChart data={mockTrendData} />
        );

        const line = getByTestId("line");
        expect(line).toHaveAttribute("data-key", "count");
        expect(line).toHaveAttribute("data-stroke", "#2563eb");
        expect(line).toHaveAttribute("data-width", "2");
      });
    });

    describe("WorkerGrowthChart", () => {
      it("should render line chart with worker growth data", () => {
        const { getByTestId } = render(
          <WorkerGrowthChart data={mockTrendData} />
        );

        expect(getByTestId("line-chart")).toBeInTheDocument();
      });

      it("should pass correct data to chart", () => {
        const { getByTestId } = render(
          <WorkerGrowthChart data={mockTrendData} />
        );

        const chart = getByTestId("line-chart");
        expect(chart).toHaveAttribute("data-items", "3");
      });

      it("should render line with worker-specific color", () => {
        const { getByTestId } = render(
          <WorkerGrowthChart data={mockTrendData} />
        );

        const line = getByTestId("line");
        expect(line).toHaveAttribute("data-stroke", "#16a34a");
      });

      it("should display all chart components", () => {
        const { getByTestId } = render(
          <WorkerGrowthChart data={mockTrendData} />
        );

        expect(getByTestId("x-axis")).toBeInTheDocument();
        expect(getByTestId("y-axis")).toBeInTheDocument();
        expect(getByTestId("tooltip")).toBeInTheDocument();
      });
    });

    describe("TopCategoriesChart", () => {
      it("should render bar chart with category data", () => {
        const { getByTestId } = render(
          <TopCategoriesChart data={mockCategoryData} />
        );

        expect(getByTestId("bar-chart")).toBeInTheDocument();
      });

      it("should pass correct data items", () => {
        const { getByTestId } = render(
          <TopCategoriesChart data={mockCategoryData} />
        );

        const chart = getByTestId("bar-chart");
        expect(chart).toHaveAttribute("data-items", "3");
      });

      it("should render bar with correct styling", () => {
        const { getByTestId } = render(
          <TopCategoriesChart data={mockCategoryData} />
        );

        const bar = getByTestId("bar");
        expect(bar).toHaveAttribute("data-key", "count");
        expect(bar).toHaveAttribute("data-fill", "#2563eb");
      });

      it("should display all axis components", () => {
        const { getByTestId } = render(
          <TopCategoriesChart data={mockCategoryData} />
        );

        expect(getByTestId("x-axis")).toBeInTheDocument();
        expect(getByTestId("y-axis")).toBeInTheDocument();
        expect(getByTestId("grid")).toBeInTheDocument();
      });
    });
  });

  describe("Curator Charts", () => {
    const mockViewTrends = [
      { date: "2024-01-01", views: 10 },
      { date: "2024-01-02", views: 15 },
      { date: "2024-01-03", views: 12 },
    ];

    const mockWorkerStats = [
      {
        id: "1",
        name: "John Doe",
        views: 100,
        bookmarks: 10,
        tips: 5,
        contacts: 3,
        category: "Construction",
        isActive: true,
      },
      {
        id: "2",
        name: "Jane Smith",
        views: 150,
        bookmarks: 20,
        tips: 8,
        contacts: 5,
        category: "Plumbing",
        isActive: true,
      },
    ];

    describe("ViewTrendsChart", () => {
      it("should render view trends line chart", () => {
        const { getByTestId } = render(
          <ViewTrendsChart
            trends={mockViewTrends}
            trendsLoading={false}
            workerName="John Doe"
          />
        );

        expect(getByTestId("line-chart")).toBeInTheDocument();
      });

      it("should pass correct data to chart", () => {
        const { getByTestId } = render(
          <ViewTrendsChart
            trends={mockViewTrends}
            trendsLoading={false}
            workerName="John Doe"
          />
        );

        const chart = getByTestId("line-chart");
        expect(chart).toHaveAttribute("data-items", "3");
      });

      it("should display loading state", () => {
        const { getByTestId, queryByTestId } = render(
          <ViewTrendsChart
            trends={null}
            trendsLoading={true}
            workerName="John Doe"
          />
        );

        expect(queryByTestId("line-chart")).not.toBeInTheDocument();
      });

      it("should handle empty trends data", () => {
        const { queryByTestId } = render(
          <ViewTrendsChart
            trends={[]}
            trendsLoading={false}
            workerName="John Doe"
          />
        );

        expect(queryByTestId("line-chart")).not.toBeInTheDocument();
      });

      it("should render with tooltip formatter", () => {
        const { getByTestId } = render(
          <ViewTrendsChart
            trends={mockViewTrends}
            trendsLoading={false}
            workerName="John Doe"
          />
        );

        const tooltip = getByTestId("tooltip");
        expect(tooltip).toHaveAttribute("data-has-formatter", "true");
      });

      it("should render with line styling", () => {
        const { getByTestId } = render(
          <ViewTrendsChart
            trends={mockViewTrends}
            trendsLoading={false}
            workerName="John Doe"
          />
        );

        const line = getByTestId("line");
        expect(line).toHaveAttribute("data-key", "views");
        expect(line).toHaveAttribute("data-stroke", "#2563eb");
      });
    });

    describe("WorkersBarChart", () => {
      it("should render workers bar chart", () => {
        const { getByTestId } = render(
          <WorkersBarChart workers={mockWorkerStats} />
        );

        expect(getByTestId("bar-chart")).toBeInTheDocument();
      });

      it("should pass correct worker data", () => {
        const { getByTestId } = render(
          <WorkersBarChart workers={mockWorkerStats} />
        );

        const chart = getByTestId("bar-chart");
        expect(chart).toHaveAttribute("data-items", "2");
      });

      it("should render bar with views data", () => {
        const { getByTestId } = render(
          <WorkersBarChart workers={mockWorkerStats} />
        );

        const bar = getByTestId("bar");
        expect(bar).toHaveAttribute("data-key", "views");
        expect(bar).toHaveAttribute("data-fill", "#2563eb");
      });

      it("should handle empty workers array", () => {
        const { queryByTestId } = render(
          <WorkersBarChart workers={[]} />
        );

        expect(queryByTestId("bar-chart")).not.toBeInTheDocument();
      });

      it("should display all chart components", () => {
        const { getByTestId } = render(
          <WorkersBarChart workers={mockWorkerStats} />
        );

        expect(getByTestId("x-axis")).toBeInTheDocument();
        expect(getByTestId("y-axis")).toBeInTheDocument();
        expect(getByTestId("tooltip")).toBeInTheDocument();
      });
    });
  });

  describe("Chart Theme Consistency", () => {
    it("should use consistent blue color for primary charts", () => {
      const mockData = [{ month: "Jan", count: 10 }];
      const { getByTestId: getUserGrowth } = render(
        <UserGrowthChart data={mockData} />
      );
      const userLine = getUserGrowth("line");

      expect(userLine).toHaveAttribute("data-stroke", "#2563eb");
    });

    it("should use consistent tooltip styling across charts", () => {
      const mockData = [{ date: "2024-01-01", views: 10 }];
      const { getByTestId } = render(
        <ViewTrendsChart
          trends={mockData}
          trendsLoading={false}
          workerName="Test"
        />
      );

      const tooltip = getByTestId("tooltip");
      expect(tooltip).toHaveAttribute("data-has-formatter", "true");
    });

    it("should use consistent grid styling", () => {
      const mockData = [{ month: "Jan", count: 10 }];
      const { getByTestId } = render(
        <UserGrowthChart data={mockData} />
      );

      expect(getByTestId("grid")).toBeInTheDocument();
    });
  });

  describe("Chart Snapshots", () => {
    it("should match UserGrowthChart snapshot", () => {
      const mockData = [
        { month: "January", count: 10 },
        { month: "February", count: 15 },
      ];
      const { container } = render(
        <UserGrowthChart data={mockData} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match TopCategoriesChart snapshot", () => {
      const mockData = [
        { name: "Construction", count: 45 },
        { name: "Plumbing", count: 32 },
      ];
      const { container } = render(
        <TopCategoriesChart data={mockData} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });

    it("should match WorkersBarChart snapshot", () => {
      const mockData = [
        {
          id: "1",
          name: "John",
          views: 100,
          bookmarks: 10,
          tips: 5,
          contacts: 3,
          category: "Construction",
          isActive: true,
        },
      ];
      const { container } = render(
        <WorkersBarChart workers={mockData} />
      );

      expect(container.firstChild).toMatchSnapshot();
    });
  });
});
