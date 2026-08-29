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

interface WorkerAnalyticsChartsProps {
  data: PersonalAnalytics;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ChartCard title="Views over time">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data.charts.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleDateString()} />
            <Area type="monotone" dataKey="views" name="Views" stroke="#2563eb" fill="#dbeafe" />
            <Area type="monotone" dataKey="uniqueViews" name="Unique views" stroke="#0891b2" fill="#cffafe" />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Tips and earnings">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data.charts.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} fontSize={12} />
            <YAxis fontSize={12} />
            <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleDateString()} />
            <Bar dataKey="earnings" name="Earnings (XLM)" fill="#16a34a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Ratings trend">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.charts.series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" tickFormatter={formatDateLabel} fontSize={12} />
            <YAxis domain={[0, 5]} fontSize={12} />
            <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleDateString()} />
            <Line
              type="monotone"
              dataKey="avgRating"
              name="Average rating"
              stroke="#f59e0b"
              strokeWidth={2}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Rating distribution">
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
            <Bar dataKey="count" name="Reviews" fill="#f59e0b" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
