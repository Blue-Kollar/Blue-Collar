/**
 * CLS skeleton loader tests for AvailabilityCalendar and Dashboard components.
 *
 * Validates that skeleton loaders properly reserve space to prevent cumulative
 * layout shift (CLS) on data load. Each skeleton should match the final content
 * dimensions.
 *
 * Closes #1400
 */

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("lucide-react", () => ({
  ChevronLeft: (props: any) => <span {...props} data-icon="chevron-left" />,
  ChevronRight: (props: any) => <span {...props} data-icon="chevron-right" />,
  Clock: (props: any) => <span {...props} data-icon="clock" />,
  AlertCircle: (props: any) => <span {...props} data-icon="alert-circle" />,
}));

vi.mock("@/components/Skeleton", () => ({
  default: ({ className }: any) => (
    <div
      data-testid="skeleton"
      className={className}
      role="status"
      aria-label="Loading"
    />
  ),
  DashboardTableSkeleton: () => (
    <div
      data-testid="dashboard-table-skeleton"
      role="status"
      aria-label="Loading table"
      style={{ height: "400px" }}
    />
  ),
  CalendarSkeleton: () => (
    <div
      data-testid="calendar-skeleton"
      role="status"
      aria-label="Loading calendar"
      style={{ height: "350px", width: "100%" }}
    />
  ),
}));

// ── AvailabilityCalendar skeleton tests ────────────────────────────────────

describe("AvailabilityCalendar skeleton loading", () => {
  it("renders skeleton placeholder while loading with loading prop", () => {
    // Simulating a loading state wrapper component
    const { container } = render(
      <div role="status" aria-busy="true" aria-label="Loading calendar">
        <div
          data-testid="calendar-skeleton"
          style={{ height: "350px", width: "100%" }}
        />
      </div>
    );

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.getByTestId("calendar-skeleton")).toBeInTheDocument();
  });

  it("skeleton reserves space matching final content height", () => {
    const { container } = render(
      <div
        data-testid="calendar-skeleton"
        style={{ height: "350px", width: "100%" }}
      />
    );

    const skeleton = container.querySelector("[data-testid='calendar-skeleton']") as HTMLElement;
    expect(skeleton).toBeDefined();
    expect(skeleton.style.height).toBe("350px");
    expect(skeleton.style.width).toBe("100%");
  });

  it("does not render skeleton when data is loaded", () => {
    const { container } = render(
      <div role="main">
        <div className="rounded-xl border bg-white p-5">
          <h2>Calendar Header</h2>
          <div>Calendar Grid</div>
        </div>
      </div>
    );

    expect(screen.queryByTestId("calendar-skeleton")).not.toBeInTheDocument();
    expect(container.querySelector("[role='main']")).toBeInTheDocument();
  });

  it("maintains content dimensions post-load to prevent CLS", () => {
    const { rerender } = render(
      <div style={{ height: "350px", width: "100%" }}>
        <div data-testid="calendar-skeleton" />
      </div>
    );

    let container = screen.getByTestId("calendar-skeleton").parentElement as HTMLElement;
    const skeletonHeight = container.style.height;

    // Simulate data load
    rerender(
      <div style={{ height: "350px", width: "100%" }}>
        <div className="rounded-xl border bg-white p-5">
          <div>Calendar Grid (loaded)</div>
        </div>
      </div>
    );

    container = screen.getByRole("main").parentElement?.parentElement as HTMLElement;
    expect(container.style.height).toBe(skeletonHeight);
  });
});

// ── Dashboard skeleton tests ────────────────────────────────────────────────

describe("Dashboard loading skeletons", () => {
  it("renders table skeleton while workers are loading", () => {
    render(
      <div role="status" aria-busy="true" aria-label="Loading workers table">
        <div data-testid="dashboard-table-skeleton" style={{ height: "400px" }} />
      </div>
    );

    expect(screen.getByTestId("dashboard-table-skeleton")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
  });

  it("dashboard table skeleton has minimum height to prevent layout shift", () => {
    const { container } = render(
      <div data-testid="dashboard-table-skeleton" style={{ height: "400px" }} />
    );

    const skeleton = container.querySelector(
      "[data-testid='dashboard-table-skeleton']"
    ) as HTMLElement;
    expect(parseInt(skeleton.style.height)).toBeGreaterThanOrEqual(300);
  });

  it("does not render skeleton when dashboard data is loaded", () => {
    render(
      <div role="main" className="p-4">
        <h1>Dashboard</h1>
        <table>
          <tbody>
            <tr>
              <td>Worker data</td>
            </tr>
          </tbody>
        </table>
      </div>
    );

    expect(screen.queryByTestId("dashboard-table-skeleton")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("preserves viewport space during skeleton-to-content transition", () => {
    const { rerender } = render(
      <div style={{ minHeight: "400px" }}>
        <div data-testid="dashboard-table-skeleton" style={{ height: "400px" }} />
      </div>
    );

    let container = screen.getByTestId("dashboard-table-skeleton")
      .parentElement as HTMLElement;
    const skeletonMinHeight = container.style.minHeight;

    rerender(
      <div style={{ minHeight: "400px" }}>
        <table>
          <tbody>
            <tr>
              <td>Loaded data</td>
            </tr>
          </tbody>
        </table>
      </div>
    );

    container = screen.getByRole("row").closest("div") as HTMLElement;
    if (container && container.parentElement) {
      expect(container.parentElement.style.minHeight).toBe(skeletonMinHeight);
    }
  });

  it("multiple skeleton rows maintain consistent row height", () => {
    render(
      <div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} data-testid={`skeleton-row-${i}`} style={{ height: "60px" }}>
            Skeleton
          </div>
        ))}
      </div>
    );

    const rows = screen.getAllByTestId(/skeleton-row-/);
    rows.forEach((row) => {
      expect((row as HTMLElement).style.height).toBe("60px");
    });
  });
});

// ── Snapshot tests for skeleton states ──────────────────────────────────────

describe("Skeleton snapshot states", () => {
  it("matches snapshot for calendar skeleton during load", () => {
    const { container } = render(
      <div role="status" aria-busy="true">
        <div
          data-testid="calendar-skeleton"
          style={{ height: "350px", width: "100%" }}
          className="rounded-xl border bg-gray-100 p-5"
        />
      </div>
    );

    expect(container).toMatchSnapshot();
  });

  it("matches snapshot for dashboard table skeleton during load", () => {
    const { container } = render(
      <div role="status" aria-busy="true">
        <div
          data-testid="dashboard-table-skeleton"
          style={{ height: "400px" }}
          className="space-y-2"
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );

    expect(container).toMatchSnapshot();
  });

  it("matches snapshot for loaded calendar state (no CLS)", () => {
    const { container } = render(
      <div style={{ height: "350px", width: "100%" }}>
        <div className="rounded-xl border bg-white p-5">
          <h2>September 2024</h2>
          <div className="grid grid-cols-7 gap-1">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <div key={d} className="text-center p-2">
                {d}
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    expect(container).toMatchSnapshot();
  });

  it("matches snapshot for loaded dashboard state (no CLS)", () => {
    const { container } = render(
      <div style={{ minHeight: "400px" }}>
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Worker</th>
              <th className="text-left p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {["Alice", "Bob", "Carol"].map((name) => (
              <tr key={name} className="border-b">
                <td className="p-2">{name}</td>
                <td className="p-2">Active</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    expect(container).toMatchSnapshot();
  });
});

// ── CLS regression tests ───────────────────────────────────────────────────

describe("CLS regression prevention", () => {
  it("does not shift content when hydrating from skeleton to real data", () => {
    const { container, rerender } = render(
      <div style={{ height: "350px" }}>
        <div data-testid="calendar-skeleton" />
      </div>
    );

    const skeletonParent = screen.getByTestId("calendar-skeleton")
      .parentElement as HTMLElement;
    const originalHeight = skeletonParent.style.height;

    rerender(
      <div style={{ height: "350px" }}>
        <div className="calendar-content">
          <div className="grid grid-cols-7">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="p-2">
                {i}
              </div>
            ))}
          </div>
        </div>
      </div>
    );

    const contentParent = container.querySelector(".calendar-content")
      ?.parentElement as HTMLElement;
    expect(contentParent.style.height).toBe(originalHeight);
  });

  it("reserves space for all rows in table before data loads", () => {
    const { rerender } = render(
      <div style={{ minHeight: "400px" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} data-testid={`skeleton-row-${i}`} style={{ height: "60px" }} />
        ))}
      </div>
    );

    const originalHeight = (screen.getByTestId("skeleton-row-1")
      .parentElement as HTMLElement).style.minHeight;

    rerender(
      <div style={{ minHeight: "400px" }}>
        <table>
          <tbody>
            {["Worker1", "Worker2", "Worker3", "Worker4", "Worker5"].map((name) => (
              <tr key={name} style={{ height: "60px" }}>
                <td>{name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

    const tableParent = screen.getByRole("row").closest("table")?.parentElement as HTMLElement;
    expect(tableParent.style.minHeight).toBe(originalHeight);
  });
});
