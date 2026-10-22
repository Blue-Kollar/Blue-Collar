"use client";

import dynamic from "next/dynamic";
import { X } from "lucide-react";
import type { ViewTrend } from "@/types";

const ViewTrendsChart = dynamic(
  () => import("@/components/charts/CuratorCharts").then((m) => m.ViewTrendsChart),
  {
    ssr: false,
    loading: () => <div className="h-[250px] rounded-lg bg-gray-50 animate-pulse" />,
  }
);

interface WorkerTrendsPanelProps {
  trends: ViewTrend[];
  workerName: string;
  trendsLoading: boolean;
  onClose: () => void;
}

/** Inline 30-day view-trends chart for a single worker. */
export function WorkerTrendsPanel({
  trends,
  workerName,
  trendsLoading,
  onClose,
}: WorkerTrendsPanelProps) {
  return (
    <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Views — {workerName} (Last 30 days)</h3>
        <button onClick={onClose} className="rounded-md p-1 text-gray-400 hover:text-gray-600">
          <X size={16} />
        </button>
      </div>
      <ViewTrendsChart
        trends={trends}
        trendsLoading={trendsLoading}
        workerName={workerName}
      />
    </div>
  );
}
