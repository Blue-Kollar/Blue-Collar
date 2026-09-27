"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Users,
  Briefcase,
  Eye,
  MessageSquare,
  Star,
  Download,
  DollarSign,
  Shield,
  Scale,
  ClipboardList,
  Tags,
  Search,
  ExternalLink,
} from "lucide-react";
import { MetricCard } from "@/components/Dashboard";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";
import { AdminDashboardSkeleton } from "@/components/Skeleton";
import { getPlatformAnalytics, exportPlatformAnalyticsCsv } from "@/lib/api";
import type { PlatformAnalytics } from "@/types";

// ── Dynamic imports (code splitting: recharts is ~200KB) ─────────────────────
const AdminCharts = dynamic(
  () => import("@/components/charts/AdminCharts"),
  { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-gray-50 animate-pulse" /> }
);

const QUICK_LINKS = [
  {
    href: "/dashboard/admin/users",
    icon: Shield,
    label: "User Management",
    sub: "Ban, suspend, manage",
    color: "blue",
  },
  {
    href: "/dashboard/admin/disputes",
    icon: Scale,
    label: "Dispute Review",
    sub: "Resolve disputes",
    color: "yellow",
  },
  {
    href: "/dashboard/admin/audit",
    icon: ClipboardList,
    label: "Audit Log",
    sub: "View activity",
    color: "purple",
  },
  {
    href: "/dashboard/admin/categories",
    icon: Tags,
    label: "Categories",
    sub: "Browse categories",
    color: "orange",
  },
  {
    href: "/dashboard/admin/moderation",
    icon: Search,
    label: "Moderation",
    sub: "Review queue",
    color: "green",
  },
] as const;

const QUICK_LINK_COLORS: Record<string, string> = {
  blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400",
  yellow: "bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400",
  purple: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400",
  orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400",
  green: "bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400",
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
      return;
    }

    getPlatformAnalytics()
      .then((res) => setData(res.data))
      .catch(() => toast("Failed to load dashboard analytics", "error"))
      .finally(() => setIsLoading(false));
  }, [user, router, toast]);

  const handleExportCsv = () => {
    const link = document.createElement("a");
    link.href = exportPlatformAnalyticsCsv();
    link.setAttribute("download", "platform-analytics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user || user.role !== "admin") return null;
  if (isLoading) return <AdminDashboardSkeleton />;
  if (!data) return <div className="p-8 text-center text-gray-500">Failed to load analytics</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Dashboard</h1>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Quick Links */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        {QUICK_LINKS.map(({ href, icon: Icon, label, sub, color }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${QUICK_LINK_COLORS[color]}`}>
              <Icon size={20} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
              <p className="text-xs text-gray-500">{sub}</p>
            </div>
            <ExternalLink size={14} className="ml-auto text-gray-400" />
          </Link>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<Briefcase size={20} />}
          label="Total Workers"
          value={data.overview.totalWorkers}
          sub={`${data.overview.activeWorkers} active`}
        />
        <MetricCard
          icon={<Users size={20} />}
          label="Total Users"
          value={data.overview.totalUsers}
          sub={`${data.overview.totalCurators} curators`}
        />
        <MetricCard
          icon={<Eye size={20} />}
          label="Profile Views"
          value={data.engagement.totalViews}
          sub={`${data.engagement.viewsThisMonth.toLocaleString()} this month`}
        />
        <MetricCard
          icon={<DollarSign size={20} />}
          label="Total Tips"
          value={`${data.revenue.totalTips.toLocaleString()} XLM`}
          sub={`${data.revenue.totalTipCount} transactions`}
        />
      </div>

      {/* Growth Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Workers This Month"
          value={data.growth.workersThisMonth}
          trend={data.growth.workerGrowthPct}
        />
        <MetricCard
          label="Users This Month"
          value={data.growth.usersThisMonth}
          trend={data.growth.userGrowthPct}
        />
        <MetricCard
          icon={<Star size={20} />}
          label="Reviews"
          value={data.engagement.totalReviews}
          sub={`${data.engagement.reviewsThisMonth} this month`}
        />
        <MetricCard
          icon={<MessageSquare size={20} />}
          label="Contact Requests"
          value={data.engagement.totalContacts}
          sub={`${data.engagement.contactsThisMonth} this month`}
        />
      </div>

      {/* Growth Trends Charts */}
      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">User Growth (6 months)</h2>
          <AdminCharts.UserGrowthChart data={data.trends.userGrowth} />
        </div>

        <div className="rounded-lg border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Worker Growth (6 months)</h2>
          <AdminCharts.WorkerGrowthChart data={data.trends.workerGrowth} />
        </div>
      </div>

      {/* Top Categories Chart */}
      <div className="mb-8 rounded-lg border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Top Categories</h2>
        <AdminCharts.TopCategoriesChart data={data.topCategories} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Worker Registrations</h2>
          <div className="space-y-3">
            {data.recentWorkers.length > 0 ? (
              data.recentWorkers.map((worker) => (
                <div key={worker.id} className="flex items-start justify-between border-b pb-3 last:border-b-0 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{worker.name}</p>
                    <p className="text-sm text-gray-500">{worker.category.name}</p>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(new Date(worker.createdAt))}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No recent registrations</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Recent User Signups</h2>
          <div className="space-y-3">
            {data.recentUsers.length > 0 ? (
              data.recentUsers.map((u) => (
                <div key={u.id} className="flex items-start justify-between border-b pb-3 last:border-b-0 dark:border-gray-800">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <RoleBadge role={u.role} />
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(new Date(u.createdAt))}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No recent signups</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// StatCard → use shared MetricCard from @/components/Dashboard
// GrowthCard → use shared MetricCard with `trend` prop from @/components/Dashboard

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-red-50 text-red-600",
    curator: "bg-purple-50 text-purple-600",
    user: "bg-blue-50 text-blue-600",
  };
  return (
    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[role] ?? "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
}
