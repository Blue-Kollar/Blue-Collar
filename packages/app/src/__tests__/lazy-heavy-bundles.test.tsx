/**
 * lazy-heavy-bundles.test.tsx
 * Closes #1569 — the leaflet and recharts wrappers render a loading fallback
 * before their heavy module resolves.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LazyWorkerMap from "@/components/LazyWorkerMap";
import { LazyWorkerAnalyticsCharts } from "@/components/Dashboard/LazyWorkerAnalyticsCharts";

afterEach(cleanup);

describe("LazyWorkerMap", () => {
  it("shows the map loading fallback while leaflet is loading", () => {
    render(<LazyWorkerMap workers={[]} />);

    expect(screen.getByText("Loading map…")).toBeInTheDocument();
  });
});

describe("LazyWorkerAnalyticsCharts", () => {
  it("shows the charts loading fallback while recharts is loading", () => {
    render(<LazyWorkerAnalyticsCharts data={{} as never} />);

    expect(screen.getByText("Loading charts…")).toBeInTheDocument();
  });
});
