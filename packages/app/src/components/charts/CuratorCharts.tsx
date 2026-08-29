"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ViewTrend {
  date: string;
  views: number;
}

interface WorkerStats {
  id: string;
  name: string;
  views: number;
  bookmarks: number;
  tips: number;
  contacts: number;
  category: string;
  isActive: boolean;
}

interface Props {
  trends: ViewTrend[] | null;
  trendsLoading: boolean;
  workerName: string;
  workers: WorkerStats[];
}

export function ViewTrendsChart({ trends, trendsLoading, workerName }: { trends: ViewTrend[] | null; trendsLoading: boolean; workerName: string }) {
  if (trendsLoading) {
    return <div className="flex items-center justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }
  if (!trends || trends.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={trends}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })} fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
        <Line type="monotone" dataKey="views" stroke="#2563eb" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WorkersBarChart({ workers }: { workers: WorkerStats[] }) {
  if (workers.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={workers}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Bar dataKey="views" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
