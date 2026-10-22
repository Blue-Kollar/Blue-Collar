"use client";

import { cn } from "@/lib/utils";
import type { DashboardWorker, DatePreset } from "@/hooks/useWorkerAnalytics";

interface WorkerAnalyticsFiltersProps {
  workers: DashboardWorker[];
  selectedWorkerId: string;
  onWorkerChange: (workerId: string) => void;
  startDate: string;
  onStartDateChange: (date: string) => void;
  endDate: string;
  onEndDateChange: (date: string) => void;
  preset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
}

export function WorkerAnalyticsFilters({
  workers,
  selectedWorkerId,
  onWorkerChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  preset,
  onPresetChange,
}: WorkerAnalyticsFiltersProps) {
  return (
    <div className="mb-6 rounded-xl border bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Worker
            <select
              value={selectedWorkerId}
              onChange={(event) => onWorkerChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            >
              {workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            Start date
            <input
              type="date"
              value={startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </label>
          <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
            End date
            <input
              type="date"
              value={endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800"
            />
          </label>
        </div>
        <div className="flex rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
          {(["7", "30", "90", "custom"] as DatePreset[]).map((item) => (
            <button
              key={item}
              onClick={() => onPresetChange(item)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                preset === item
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-950 dark:text-gray-100"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
              )}
            >
              {item === "custom" ? "Custom" : `${item}D`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
