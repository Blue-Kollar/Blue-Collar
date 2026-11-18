"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import { WorkerDashboardHeader } from "@/components/dashboard/worker/WorkerDashboardHeader";
import { WorkerDashboardFilters } from "@/components/dashboard/worker/WorkerDashboardFilters";
import { WorkerDashboardContent } from "@/components/dashboard/worker/WorkerDashboardContent";
import { useWorkerAnalytics } from "@/hooks/useWorkerAnalytics";
import { useWallet } from "@/hooks/useWallet";

export default function WorkerPersonalDashboardPage() {
  const router = useRouter();
  const { address: walletAddress } = useWallet();
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
      <WorkerDashboardHeader
        walletAddress={walletAddress}
        onExportCsv={exportCsv}
        exportDisabled={!data}
      />

      <WorkerDashboardFilters
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

      <WorkerDashboardContent
        workers={workers}
        loading={loading}
        data={data}
      />
    </div>
  );
}
