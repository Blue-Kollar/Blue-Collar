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

interface TrendPoint {
  month: string;
  count: number;
}

interface TopCategory {
  name: string;
  count: number;
}

export function UserGrowthChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={2} name="New Users" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function WorkerGrowthChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" fontSize={12} />
        <YAxis fontSize={12} />
        <Tooltip />
        <Line type="monotone" dataKey="count" stroke="#16a34a" strokeWidth={2} name="New Workers" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function TopCategoriesChart({ data }: { data: TopCategory[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
