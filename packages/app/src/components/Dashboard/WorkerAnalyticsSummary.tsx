"use client";

import { Eye, Star, TrendingUp, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompact } from "@/lib/format";
import type { PersonalAnalytics } from "@/hooks/useWorkerAnalytics";
import { useTranslations } from "next-intl";

interface WorkerAnalyticsSummaryProps {
  data: PersonalAnalytics;
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
  const t = useTranslations("componentText");
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
        {label === t("averageRatingLabel") ? "" : "%"} {t("vsPreviousPeriod")}
        {sub ? ` · ${sub}` : ""}
      </p>
    </div>
  );
}

export function WorkerAnalyticsSummary({ data }: WorkerAnalyticsSummaryProps) {
  const t = useTranslations("componentText");
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <SummaryMetricCard
        icon={<Eye size={18} />}
        label={t("profileViews")}
        value={formatCompact(data.summary.totalViews)}
        delta={data.deltas.totalViews}
      />
      <SummaryMetricCard
        icon={<TrendingUp size={18} />}
        label={t("uniqueViews")}
        value={formatCompact(data.summary.uniqueViews)}
        delta={data.deltas.uniqueViews}
      />
      <SummaryMetricCard
        icon={<Wallet size={18} />}
        label={t("tipsReceived")}
        value={`${formatCompact(data.summary.tipsReceived, { maximumFractionDigits: 2 })} XLM`}
        delta={data.deltas.tipsReceived}
        sub={t("tipsCount", { count: data.summary.tipCount })}
      />
      <SummaryMetricCard
        icon={<Star size={18} />}
        label={t("averageRatingLabel")}
        value={data.summary.avgRating ? data.summary.avgRating.toFixed(1) : "—"}
        delta={data.deltas.avgRating}
        sub={t("reviewsCount", { count: data.summary.reviewCount })}
      />
    </div>
  );
}
