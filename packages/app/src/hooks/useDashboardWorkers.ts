"use client";

import { useMemo } from "react";
import type { DashboardWorker } from "@/components/Dashboard/WorkersPanel";

export interface DashboardWorkerStats {
  total: number;
  active: number;
  inactive: number;
}

/**
 * Derives summary counts for the curator's worker listings.
 * Counts are recomputed only when the workers array changes.
 */
export function useDashboardWorkers(workers: DashboardWorker[]): DashboardWorkerStats {
  return useMemo(() => {
    const active = workers.filter((w) => w.isActive).length;
    return { total: workers.length, active, inactive: workers.length - active };
  }, [workers]);
}
