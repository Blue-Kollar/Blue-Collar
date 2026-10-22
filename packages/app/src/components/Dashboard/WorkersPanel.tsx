"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Table } from "@/components/Table";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import { useDashboardWorkers } from "@/hooks/useDashboardWorkers";
import type { ViewTrend } from "@/types";
import { MetricCard } from "./MetricCard";
import { buildWorkerColumns } from "./workerTableColumns";
import { WorkerTrendsPanel } from "./WorkerTrendsPanel";

export interface DashboardWorker {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  category: { id: string; name: string };
}

interface WorkersPanelProps {
  workers: DashboardWorker[];
  loading: boolean;
  selectedWorkerTrends: ViewTrend[] | null;
  selectedWorkerName: string;
  trendsLoading: boolean;
  onToggle: (worker: DashboardWorker) => void;
  onDeleteRequest: (worker: DashboardWorker) => void;
  onViewTrends: (workerId: string, workerName: string) => void;
  onCloseTrends: () => void;
}

/**
 * Workers tab panel — summary tiles, a Table of the curator's worker listings,
 * and an inline view-trends chart panel.
 */
export function WorkersPanel({
  workers,
  loading,
  selectedWorkerTrends,
  selectedWorkerName,
  trendsLoading,
  onToggle,
  onDeleteRequest,
  onViewTrends,
  onCloseTrends,
}: WorkersPanelProps) {
  const stats = useDashboardWorkers(workers);

  if (loading) {
    return <DashboardTableSkeleton />;
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Total workers" value={stats.total} />
        <MetricCard label="Active" value={stats.active} />
        <MetricCard label="Inactive" value={stats.inactive} />
      </div>

      <Table
        columns={buildWorkerColumns({ onToggle, onDeleteRequest, onViewTrends })}
        data={workers}
        loading={false}
        emptyMessage="No workers yet. Create your first worker listing to get started."
        aria-label="Worker listings"
        className="bg-white"
      />

      {/* Empty-state CTA (Table renders text, but we want a richer prompt) */}
      {workers.length === 0 && (
        <div className="mt-4 flex justify-center">
          <Link
            href="/dashboard/workers/new"
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={15} />
            Create Worker
          </Link>
        </div>
      )}

      {selectedWorkerTrends && (
        <WorkerTrendsPanel
          trends={selectedWorkerTrends}
          workerName={selectedWorkerName}
          trendsLoading={trendsLoading}
          onClose={onCloseTrends}
        />
      )}
    </>
  );
}
