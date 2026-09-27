"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2 } from "lucide-react";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import {
  WorkerAnalyticsFilters,
  WorkerAnalyticsSummary,
  WorkerAnalyticsCharts,
} from "@/components/Dashboard";
import { useWorkerAnalytics } from "@/hooks/useWorkerAnalytics";

export default function WorkerPersonalDashboardPage() {
  const router = useRouter();
  const {
    user,
    authLoading,
    workers,
    selectedWorkerId,
    setSelectedWorkerId,
    preset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    data,
    loading,
    error,
    applyPreset,
    exportCsv,
  } = useWorkerAnalytics();

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "curator" && user.role !== "admin"))) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <DashboardTableSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Worker Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Personal profile views, tips, ratings, and earnings over time.
          </p>
        </div>
        <button
          onClick={exportCsv}
          disabled={!data}
          className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Download size={16} /> Export CSV
        </button>
      </div>

      <WorkerAnalyticsFilters
        workers={workers}
        selectedWorkerId={selectedWorkerId}
        onWorkerChange={setSelectedWorkerId}
        startDate={startDate}
        onStartDateChange={setStartDate}
        endDate={endDate}
        onEndDateChange={setEndDate}
        preset={preset}
        onPresetChange={applyPreset}
      />

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {workers.length === 0 && !loading ? (
        <div className="rounded-xl border bg-white py-16 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-900">
          Create a worker profile to start collecting dashboard metrics.
        </div>
      ) : loading ? (
        <DashboardTableSkeleton />
      ) : data ? (
        <div className="space-y-6">
          <WorkerAnalyticsSummary data={data} />
          <WorkerAnalyticsCharts data={data} />
        </div>
      ) : (
        <div className="flex items-center justify-center rounded-xl border bg-white py-16 dark:border-gray-700 dark:bg-gray-900">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
}
