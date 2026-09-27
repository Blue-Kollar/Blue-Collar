"use client";

import { Eye, Star, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PersonalAnalytics } from "@/hooks/useWorkerAnalytics";

interface WorkerAnalyticsSummaryProps {
  data: PersonalAnalytics;
}

function formatXlm(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM`;
}

function SummaryMetricCard({
  icon,
  label,
  value,
  delta,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number;
  sub?: string;
}) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="mb-2 flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          isPositive ? "text-green-600" : isNegative ? "text-red-600" : "text-gray-400"
        )}
      >
        {delta > 0 ? "+" : ""}
        {delta}
        {label === "Avg rating" ? "" : "%"} vs previous period
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}

export function WorkerAnalyticsSummary({ data }: WorkerAnalyticsSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryMetricCard
        icon={<Eye size={18} />}
        label="Profile views"
        value={data.summary.totalViews.toLocaleString()}
        delta={data.deltas.totalViews}
      />
      <SummaryMetricCard
        icon={<TrendingUp size={18} />}
        label="Unique views"
        value={data.summary.uniqueViews.toLocaleString()}
        delta={data.deltas.uniqueViews}
      />
      <SummaryMetricCard
        icon={<Wallet size={18} />}
        label="Tips received"
        value={formatXlm(data.summary.tipsReceived)}
        delta={data.deltas.tipsReceived}
        sub={`${data.summary.tipCount} tips`}
      />
      <SummaryMetricCard
        icon={<Star size={18} />}
        label="Avg rating"
        value={data.summary.avgRating ? data.summary.avgRating.toFixed(1) : "—"}
        delta={data.deltas.avgRating}
        sub={`${data.summary.reviewCount} reviews`}
      />
    </div>
  );
}
