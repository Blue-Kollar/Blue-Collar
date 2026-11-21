"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PersonalAnalytics } from "@/hooks/useWorkerAnalytics";
import { formatDate } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface WorkerAnalyticsChartsProps {
  data: PersonalAnalytics;
}

function formatDateLabel(value: string) {
  return formatDate(value, { month: "short", day: "numeric" });
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
      {children}
    </div>
  );
}

export function WorkerAnalyticsCharts({ data }: WorkerAnalyticsChartsProps) {
  const t = useTranslations("componentText");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title={t("viewsOverTime")}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.charts.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip labelFormatter={(value) => formatDate(String(value))} />
            <Area type="monotone" dataKey="views" name={t("views")} stroke="#2563eb" fill="#dbeafe" />
            <Area type="monotone" dataKey="uniqueViews" name={t("uniqueViews")} stroke="#0891b2" fill="#cffafe" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("tipsAndEarnings")}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.charts.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip labelFormatter={(value) => formatDate(String(value))} />
            <Bar dataKey="earnings" name={t("earningsXlm")} fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("ratingsTrend")}>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.charts.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} fontSize={12} />
            <YAxis domain={[0, 5]} fontSize={12} />
            <Tooltip labelFormatter={(value) => formatDate(String(value))} />
            <Line
              type="monotone"
              dataKey="avgRating"
              name={t("averageRating")}
              stroke="#f59e0b"
              strokeWidth={2}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("ratingDistribution")}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.charts.ratingDistribution} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} fontSize={12} />
            <YAxis
              type="category"
              dataKey="rating"
              tickFormatter={(rating) => `${rating}★`}
              fontSize={12}
            />
            <Tooltip />
            <Bar dataKey="count" name={t("reviews")} fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
