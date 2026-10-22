"use client";

import dynamic from "next/dynamic";
import { Eye, Heart, Star, MessageSquare, Download } from "lucide-react";
import { Table, type ColumnDef } from "@/components/Table";
import { MetricCard } from "./MetricCard";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import type { CuratorAnalytics } from "@/types";
import { useTranslations } from "next-intl";

// ── Dynamic import (code splitting) ─────────────────────────────────────────
const WorkersBarChart = dynamic(
  () => import("@/components/charts/CuratorCharts").then((m) => m.WorkersBarChart),
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
  const t = useTranslations("componentText");
  const workerColumns: ColumnDef<WorkerAnalyticsRow>[] = [
    {
      key: "name",
      header: t("worker"),
      cell: (w) => (
        <div className="flex items-center gap-2 font-medium text-gray-800">
          {w.name}
          {!w.isActive && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              {t("inactive")}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "category",
      header: t("category"),
      cell: (w) => <span className="text-gray-500">{w.category}</span>,
      hideOnMobile: true,
    },
    {
      key: "views",
      header: t("views"),
      className: "text-right",
      cell: (w) => (
        <span className="tabular-nums text-gray-700">{formatCompact(w.views)}</span>
      ),
    },
    {
      key: "bookmarks",
      header: t("bookmarks"),
      className: "text-right",
      cell: (w) => <span className="tabular-nums text-gray-700">{w.bookmarks}</span>,
      hideOnMobile: true,
    },
    {
      key: "tips",
      header: t("tips"),
      className: "text-right",
      cell: (w) => (
        <span className="tabular-nums text-gray-700">{formatCompact(w.tips)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: "contacts",
      header: t("contacts"),
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
        <p className="text-gray-500">{t("analyticsUnavailable")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          icon={<Eye size={18} />}
          label={t("totalViews")}
          value={analytics.totals.views}
          sub={`${analytics.totals.viewsThisMonth} ${t("thisMonth")}`}
        />
        <MetricCard
          icon={<Heart size={18} />}
          label={t("bookmarks")}
          value={analytics.totals.bookmarks}
        />
        <MetricCard
          icon={<Star size={18} />}
          label={t("averageRating")}
          value={analytics.totals.avgRating?.toFixed(1) ?? "—"}
          sub={t("reviewsCount", { count: analytics.totals.reviewCount ?? 0 })}
        />
        <MetricCard
          icon={<MessageSquare size={18} />}
          label={t("contacts")}
          value={analytics.totals.contacts}
          sub={`${analytics.totals.contactsThisMonth} ${t("thisMonth")}`}
        />
      </div>

      {/* Revenue / workers overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t("totalTipsReceived")}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {formatCompact(analytics.totals.tips, { maximumFractionDigits: 2 })} XLM
          </p>
          <p className="mt-0.5 text-xs text-gray-400">
            {t("transactionsCount", { count: analytics.totals.tipCount })}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">{t("workersOverview")}</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {analytics.activeWorkers}{" "}
            <span className="text-base font-normal text-gray-400">
              / {t("activeCount", { count: analytics.totalWorkers })}
            </span>
          </p>
        </div>
      </div>

      {/* Per-worker breakdown */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">{t("workerPerformance")}</h3>
          <button
            onClick={onExportCsv}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download size={13} />
            {t("exportCsv")}
          </button>
        </div>
        <Table
          columns={workerColumns}
          data={analytics.workers as WorkerAnalyticsRow[]}
          emptyMessage={t("noWorkerData")}
          aria-label={t("workerPerformance")}
          className="rounded-none border-0"
        />
      </div>

      {/* Views by worker chart */}
      {analytics.workers.length > 0 && (
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("viewsByWorker")}</h3>
          <WorkersBarChart workers={analytics.workers} />
        </div>
      )}
    </div>
  );
}
