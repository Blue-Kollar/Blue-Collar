"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export type DatePreset = "7" | "30" | "90" | "custom";

export type DashboardWorker = {
  id: string;
  name: string;
  isActive: boolean;
  category: { id: string; name: string };
};

export type SeriesPoint = {
  date: string;
  views: number;
  uniqueViews: number;
  tips: number;
  tipCount: number;
  avgRating: number | null;
  reviewCount: number;
  earnings: number;
};

export type PersonalAnalytics = {
  worker: { id: string; name: string; category: string; walletAddress?: string | null };
  range: { startDate: string; endDate: string };
  summary: {
    totalViews: number;
    uniqueViews: number;
    tipsReceived: number;
    tipCount: number;
    avgRating: number;
    reviewCount: number;
    earnings: number;
    contacts: number;
  };
  deltas: {
    totalViews: number;
    uniqueViews: number;
    tipsReceived: number;
    avgRating: number;
    earnings: number;
  };
  charts: {
    series: SeriesPoint[];
    ratingDistribution: Array<{ rating: number; count: number }>;
  };
};

export function dateDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function useWorkerAnalytics() {
  const { user, token, isLoading: authLoading } = useAuth();
  const [workers, setWorkers] = useState<DashboardWorker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [preset, setPreset] = useState<DatePreset>("30");
  const [startDate, setStartDate] = useState(dateDaysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [data, setData] = useState<PersonalAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const rangeParams = useMemo(() => {
    const params = new URLSearchParams({ startDate, endDate });
    return params.toString();
  }, [startDate, endDate]);

  const loadWorkers = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`${API}/workers/mine?limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to load your workers");
    const json = await res.json();
    const rows = json.data ?? [];
    setWorkers(rows);
    if (!selectedWorkerId && rows[0]?.id) setSelectedWorkerId(rows[0].id);
  }, [token, selectedWorkerId]);

  const loadAnalytics = useCallback(async () => {
    if (!token || !selectedWorkerId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/workers/${selectedWorkerId}/analytics/dashboard?${rangeParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? "Failed to load worker analytics");
      }
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load worker analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [token, selectedWorkerId, rangeParams]);

  useEffect(() => {
    if (!authLoading && token) {
      loadWorkers().catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load your workers");
        setLoading(false);
      });
    }
  }, [authLoading, token, loadWorkers]);

  useEffect(() => {
    if (selectedWorkerId) loadAnalytics();
  }, [selectedWorkerId, loadAnalytics]);

  const applyPreset = (nextPreset: DatePreset) => {
    setPreset(nextPreset);
    if (nextPreset !== "custom") {
      const days = Number(nextPreset);
      setStartDate(dateDaysAgo(days));
      setEndDate(today());
    }
  };

  const exportCsv = () => {
    if (!selectedWorkerId || !token) return;
    window.open(`${API}/workers/${selectedWorkerId}/analytics/export?${rangeParams}`, "_blank");
  };

  return {
    user,
    token,
    authLoading,
    workers,
    selectedWorkerId,
    setSelectedWorkerId,
    preset,
    setPreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    data,
    loading,
    error,
    applyPreset,
    exportCsv,
    refetchWorkers: loadWorkers,
    refetchAnalytics: loadAnalytics,
  };
}
