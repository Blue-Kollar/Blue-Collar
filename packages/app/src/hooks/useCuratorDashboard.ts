"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import type { CuratorAnalytics, ViewTrend } from "@/types";
import type { DashboardWorker } from "@/components/Dashboard";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const HORIZON_TESTNET = "https://horizon-testnet.stellar.org";
const IS_STELLAR_TESTNET =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK?.toLowerCase() === "testnet";

export function useCuratorDashboard() {
  const { user, token, isLoading: authLoading } = useAuth();
  const { publicKey } = useWallet();

  const [workers, setWorkers] = useState<DashboardWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [xlmBalance, setXlmBalance] = useState<number | null>(null);

  const [analytics, setAnalytics] = useState<CuratorAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  const [selectedWorkerTrends, setSelectedWorkerTrends] = useState<ViewTrend[] | null>(null);
  const [selectedWorkerName, setSelectedWorkerName] = useState<string>("");
  const [trendsLoading, setTrendsLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<"workers" | "analytics">("workers");
  const [deleteTarget, setDeleteTarget] = useState<DashboardWorker | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWorkers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/workers/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load workers");
      const json = await res.json();
      setWorkers(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAnalytics = useCallback(async () => {
    if (!token) return;
    setAnalyticsLoading(true);
    try {
      const res = await fetch(`${API}/analytics/curator`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load analytics");
      const json = await res.json();
      setAnalytics(json.data);
    } catch {
      // Analytics is supplementary — don't block the page on failure.
    } finally {
      setAnalyticsLoading(false);
    }
  }, [token]);

  const fetchWorkerTrends = useCallback(async (workerId: string, workerName: string) => {
    if (!token) return;
    setTrendsLoading(true);
    setSelectedWorkerName(workerName);
    try {
      const res = await fetch(
        `${API}/workers/${workerId}/analytics/trends?days=30`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to load trends");
      const json = await res.json();
      setSelectedWorkerTrends(json.data);
    } catch {
      setSelectedWorkerTrends(null);
    } finally {
      setTrendsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) {
      fetchWorkers();
      fetchAnalytics();
    }
  }, [authLoading, token, fetchWorkers, fetchAnalytics]);

  useEffect(() => {
    if (!IS_STELLAR_TESTNET || !publicKey) {
      setXlmBalance(null);
      return;
    }

    fetch(`${HORIZON_TESTNET}/accounts/${publicKey}`)
      .then((res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Failed to load wallet balance");
        return res.json();
      })
      .then((account) => {
        const nativeBalance = account?.balances?.find(
          (b: { asset_type: string }) => b.asset_type === "native"
        );
        setXlmBalance(nativeBalance ? Number(nativeBalance.balance) : 0);
      })
      .catch(() => setXlmBalance(null));
  }, [publicKey]);

  const handleToggle = useCallback(async (worker: DashboardWorker) => {
    setWorkers((prev) =>
      prev.map((w) => (w.id === worker.id ? { ...w, isActive: !w.isActive } : w))
    );
    try {
      const res = await fetch(`${API}/workers/${worker.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Toggle failed");
    } catch {
      setWorkers((prev) =>
        prev.map((w) => (w.id === worker.id ? { ...w, isActive: worker.isActive } : w))
      );
    }
  }, [token]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);

    setWorkers((prev) => prev.filter((w) => w.id !== target.id));
    setDeleteTarget(null);

    try {
      const res = await fetch(`${API}/workers/${target.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      setWorkers((prev) => [target, ...prev]);
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, token]);

  const handleExportCsv = useCallback(() => {
    if (!token) return;
    const link = document.createElement("a");
    link.href = `${API}/analytics/export/curator`;
    link.setAttribute("download", "worker-analytics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [token]);

  return {
    user,
    token,
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
    fetchWorkers,
    fetchAnalytics,
    fetchWorkerTrends,
    closeTrends: () => setSelectedWorkerTrends(null),
    handleToggle,
    handleDelete,
    handleExportCsv,
  };
}
