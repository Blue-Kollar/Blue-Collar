"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Table, type ColumnDef, type RowAction } from "@/components/Table";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import type { ViewTrend } from "@/types";

// ── Dynamic import (code splitting) ─────────────────────────────────────────
const CuratorCharts = dynamic(
  () => import("@/components/charts/CuratorCharts"),
  { ssr: false, loading: () => <div className="h-[250px] rounded-lg bg-gray-50 animate-pulse" /> }
);

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
 * Workers tab panel — renders a Table of the curator's worker listings
 * plus an inline view-trends chart panel.
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
  const columns: ColumnDef<DashboardWorker>[] = [
    {
      key: "name",
      header: "Name",
      cell: (w) => <span className="font-medium text-gray-800">{w.name}</span>,
    },
    {
      key: "category",
      header: "Category",
      cell: (w) => (
        <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
          {w.category.name}
        </span>
      ),
    },
    {
      key: "isActive",
      header: "Status",
      cell: (w) => (
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            w.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
          )}
        >
          {w.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      key: "createdAt",
      header: "Created",
      cell: (w) => (
        <span className="text-gray-400">
          {new Date(w.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  const rowActions: RowAction<DashboardWorker>[] = [
    {
      label: "View Trends",
      icon: <TrendingUp size={15} />,
      onClick: (w) => onViewTrends(w.id, w.name),
    },
    {
      label: "Edit",
      icon: (
        <Link
          href="#"
          onClick={(e) => e.stopPropagation()}
          className="contents"
        >
          <Pencil size={15} />
        </Link>
      ),
      // Navigate via link — the action button wraps the icon; we use onClick too
      onClick: () => {},
    },
    {
      label: "Toggle",
      icon: null, // rendered dynamically below
      onClick: (w) => onToggle(w),
    },
    {
      label: "Delete",
      icon: <Trash2 size={15} />,
      onClick: (w) => onDeleteRequest(w),
      variant: "danger",
    },
  ];

  // rowActions doesn't give us per-row icon customisation for the toggle button,
  // so we use a custom cell-based column for actions instead of rowActions prop.
  const actionsColumn: ColumnDef<DashboardWorker> = {
    key: "_actions",
    header: "Actions",
    className: "text-right",
    cell: (w) => (
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => onViewTrends(w.id, w.name)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          title="View Trends"
        >
          <TrendingUp size={15} />
        </button>
        <Link
          href={`/dashboard/workers/${w.id}/edit`}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          title="Edit"
        >
          <Pencil size={15} />
        </Link>
        <button
          onClick={() => onToggle(w)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
          title={w.isActive ? "Deactivate" : "Activate"}
        >
          {w.isActive ? (
            <ToggleRight size={17} className="text-green-500" />
          ) : (
            <ToggleLeft size={17} />
          )}
        </button>
        <button
          onClick={() => onDeleteRequest(w)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      </div>
    ),
  };

  if (loading) {
    return <DashboardTableSkeleton />;
  }

  return (
    <>
      <Table
        columns={[...columns, actionsColumn]}
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

      {/* View Trends Panel */}
      {selectedWorkerTrends && (
        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Views — {selectedWorkerName} (Last 30 days)
            </h3>
            <button
              onClick={onCloseTrends}
              className="rounded-md p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
          <CuratorCharts.ViewTrendsChart
            trends={selectedWorkerTrends}
            trendsLoading={trendsLoading}
            workerName={selectedWorkerName}
          />
        </div>
      )}
    </>
  );
}
