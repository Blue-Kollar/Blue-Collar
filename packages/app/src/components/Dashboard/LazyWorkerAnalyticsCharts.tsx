"use client";

import dynamic from "next/dynamic";
import LoadingState from "@/components/LoadingState";

/**
 * recharts-backed worker analytics charts. Loaded on demand so recharts
 * stays out of the initial bundle.
 */
export const LazyWorkerAnalyticsCharts = dynamic(
  () => import("./WorkerAnalyticsCharts").then((m) => m.WorkerAnalyticsCharts),
  {
    ssr: false,
    loading: () => (
      <LoadingState variant="inline" message="Loading charts…" className="justify-center py-12" />
    ),
  }
);
