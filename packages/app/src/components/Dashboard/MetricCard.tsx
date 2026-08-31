"use client";

import type { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MetricCardProps {
  icon?: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  /** Optional percentage change — shows a trend badge when provided. */
  trend?: number;
  className?: string;
}

/**
 * Shared metric/stat card used across the curator dashboard and admin dashboard.
 *
 * When `trend` is provided a coloured badge with a directional arrow is shown
 * beneath the value (mirrors the former GrowthCard in admin/page.tsx).
 */
export function MetricCard({ icon, label, value, sub, trend, className }: MetricCardProps) {
  const isPositive = trend !== undefined && trend >= 0;

  return (
    <div className={cn("rounded-xl border bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900", className)}>
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
          {label}
        </span>
      </div>

      {trend !== undefined ? (
        <div className="flex items-end gap-2 mt-1">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          <span
            className={cn(
              "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium",
              isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
            )}
          >
            {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </span>
        </div>
      ) : (
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
      )}

      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
      {trend !== undefined && !sub && (
        <p className="mt-0.5 text-xs text-gray-400">vs last month</p>
      )}
    </div>
  );
}
