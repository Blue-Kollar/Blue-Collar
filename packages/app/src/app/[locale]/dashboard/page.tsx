"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardTableSkeleton } from "@/components/Skeleton";
import {
  DashboardHeader,
  DashboardTabs,
  WorkersPanel,
  DeleteWorkerDialog,
} from "@/components/Dashboard";
import type { DashboardTabType } from "@/components/Dashboard";
import { DashboardWalletBanner } from "@/components/dashboard/DashboardWalletBanner";
import { DashboardErrorBanner } from "@/components/dashboard/DashboardErrorBanner";

// The analytics panel is only needed on its tab, so it loads on demand.
const AnalyticsPanel = dynamic(
  () => import("@/components/Dashboard").then((m) => m.AnalyticsPanel),
  { loading: () => null },
);
import { useCuratorDashboard } from "@/hooks/useCuratorDashboard";
import { useWallet } from "@/hooks/useWallet";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { publicKey, xlmBalance } = useWallet();
  const {
    user,
    authLoading,
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

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "workers" || tab === "analytics") setActiveTab(tab);
    // Read the tab once on mount so a shared link opens the same tab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10">
        <DashboardTableSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <DashboardWalletBanner publicKey={publicKey} xlmBalance={xlmBalance} />

      {/* Header */}
      <DashboardHeader />

      {/* Tabs */}
      <DashboardTabs
        activeTab={activeTab}
        onTabChange={(tab: DashboardTabType) => {
          setActiveTab(tab);
          router.replace(`?tab=${tab}`, { scroll: false });
        }}
      />

      {/* Error banner */}
      <DashboardErrorBanner error={error} />

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
