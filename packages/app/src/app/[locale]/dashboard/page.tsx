"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import FriendbotBanner from "@/components/FriendbotBanner";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import {
  DashboardHeader,
  DashboardTabs,
  WorkersPanel,
  AnalyticsPanel,
  DeleteWorkerDialog,
} from "@/components/Dashboard";
import { useCuratorDashboard } from "@/hooks/useCuratorDashboard";

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    authLoading,
    publicKey,
    xlmBalance,
    workers,
    loading,
    error,
    analytics,
    analyticsLoading,
    selectedWorkerTrends,
    selectedWorkerName,
    trendsLoading,
    activeTab,
    setActiveTab,
    deleteTarget,
    setDeleteTarget,
    deleting,
    fetchWorkerTrends,
    closeTrends,
    handleToggle,
    handleDelete,
    handleExportCsv,
  } = useCuratorDashboard();

  useEffect(() => {
    if (
      !authLoading &&
      (!user || (user.role !== "curator" && user.role !== "admin"))
    ) {
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
      {publicKey && xlmBalance !== null && (
        <FriendbotBanner walletAddress={publicKey} xlmBalance={xlmBalance} />
      )}

      {/* Header */}
      <DashboardHeader />

      {/* Tabs */}
      <DashboardTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Error banner */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Tab panels */}
      {activeTab === "workers" && (
        <WorkersPanel
          workers={workers}
          loading={loading}
          selectedWorkerTrends={selectedWorkerTrends}
          selectedWorkerName={selectedWorkerName}
          trendsLoading={trendsLoading}
          onToggle={handleToggle}
          onDeleteRequest={setDeleteTarget}
          onViewTrends={fetchWorkerTrends}
          onCloseTrends={closeTrends}
        />
      )}

      {activeTab === "analytics" && (
        <AnalyticsPanel
          analytics={analytics}
          loading={analyticsLoading}
          onExportCsv={handleExportCsv}
        />
      )}

      {/* Delete confirmation dialog */}
      <DeleteWorkerDialog
        workerName={deleteTarget?.name}
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        isDeleting={deleting}
      />
    </div>
  );
}
