"use client";

import dynamic from "next/dynamic";
import { Eye, Heart, Star, MessageSquare, Download } from "lucide-react";
import { Table, type ColumnDef } from "@/components/Table";
import { MetricCard } from "./MetricCard";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";
import type { CuratorAnalytics } from "@/types";

// ── Dynamic import (code splitting) ─────────────────────────────────────────
const CuratorCharts = dynamic(
  () => import("@/components/charts/CuratorCharts"),
  { ssr: false, loading: () => <div className="h-[250px] rounded-lg bg-gray-50 animate-pulse" /> }
);

// Shape of a per-worker analytics row returned by the API.
// Mirrors the type used inside CuratorAnalytics['workers'].
interface WorkerAnalyticsRow {
  id: string;
  name: string;
  category: string;
  isActive: boolean;
  views: number;
  bookmarks: number;
  tips: number;
  contacts: number;
}

interface AnalyticsPanelProps {
  analytics: CuratorAnalytics | null;
  loading: boolean;
  onExportCsv: () => void;
}

/**
 * Analytics tab panel — summary metric cards, per-worker breakdown table,
 * and views-by-worker bar chart.
 */
export function AnalyticsPanel({ analytics, loading, onExportCsv }: AnalyticsPanelProps) {
  const workerColumns: ColumnDef<WorkerAnalyticsRow>[] = [
    {
      key: "name",
      header: "Worker",
      cell: (w) => (
        <div className="flex items-center gap-2 font-medium text-gray-800">
          {w.name}
          {!w.isActive && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              Inactive
            </span>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: "Category",
      cell: (w) => <span className="text-gray-500">{w.category}</span>,
      hideOnMobile: true,
    },
    {
      key: "views",
      header: "Views",
      className: "text-right",
      cell: (w) => (
        <span className="tabular-nums text-gray-700">{w.views.toLocaleString()}</span>
      ),
    },
    {
      key: "bookmarks",
      header: "Bookmarks",
      className: "text-right",
      cell: (w) => <span className="tabular-nums text-gray-700">{w.bookmarks}</span>,
      hideOnMobile: true,
    },
    {
      key: "tips",
      header: "Tips",
      className: "text-right",
      cell: (w) => (
        <span className="tabular-nums text-gray-700">{w.tips.toLocaleString()}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: "contacts",
      header: "Contacts",
      className: "text-right",
      cell: (w) => <span className="tabular-nums text-gray-700">{w.contacts}</span>,
    },
  ];

  if (loading) {
    return <DashboardTableSkeleton />;
  }

  if (!analytics) {
    return (
      <div className="rounded-xl border bg-white py-16 text-center">
        <p className="text-gray-500">Unable to load analytics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Eye size={18} />}
          label="Total Views"
          value={analytics.totals.views}
          sub={`${analytics.totals.viewsThisMonth} this month`}
        />
        <MetricCard
          icon={<Heart size={18} />}
          label="Bookmarks"
          value={analytics.totals.bookmarks}
        />
        <MetricCard
          icon={<Star size={18} />}
          label="Avg Rating"
          value={analytics.totals.avgRating?.toFixed(1) ?? "—"}
          sub={`${analytics.totals.reviewCount ?? 0} reviews`}
        />
        <MetricCard
          icon={<MessageSquare size={18} />}
          label="Contacts"
          value={analytics.totals.contacts}
          sub={`${analytics.totals.contactsThisMonth} this month`}
        />
      </div>

      {/* Revenue / workers overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Tips Received</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {analytics.totals.tips.toLocaleString()} XLM
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {analytics.totals.tipCount} transactions
          </p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Workers Overview</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {analytics.activeWorkers}{" "}
            <span className="text-base font-normal text-gray-400">
              / {analytics.totalWorkers} active
            </span>
          </p>
        </div>
      </div>

      {/* Per-worker breakdown */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Worker Performance</h3>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
        <Table
          columns={workerColumns}
          data={analytics.workers as WorkerAnalyticsRow[]}
          emptyMessage="No worker data yet"
          aria-label="Worker performance breakdown"
          className="rounded-none border-0"
        />
      </div>

      {/* Views by worker chart */}
      {analytics.workers.length > 0 && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Views by Worker</h3>
          <CuratorCharts.WorkersBarChart workers={analytics.workers} />
        </div>
      )}
    </div>
  );
}
