'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Users, Briefcase, Eye, MessageSquare, Star, Download, DollarSign } from 'lucide-react';
import { MetricCard } from '@/components/Dashboard';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import { formatCompact } from '@/lib/format';
import { AdminDashboardSkeleton } from '@/components/Skeleton';
import { apiClient, ApiError } from '@/lib/apiClient';
import { AdminQuickLinks, RecentWorkersList, RecentUsersList } from '@/components/dashboard/admin';
import type { PlatformAnalytics } from '@/types';

// ── Dynamic imports (code splitting: recharts is ~200KB) ─────────────────────
const chartLoading = () => <div className="h-[300px] rounded-lg bg-gray-50 animate-pulse" />;

const UserGrowthChart = dynamic(
  () => import('@/components/charts/AdminCharts').then((m) => m.UserGrowthChart),
  { ssr: false, loading: chartLoading },
);
const WorkerGrowthChart = dynamic(
  () => import('@/components/charts/AdminCharts').then((m) => m.WorkerGrowthChart),
  { ssr: false, loading: chartLoading },
);
const TopCategoriesChart = dynamic(
  () => import('@/components/charts/AdminCharts').then((m) => m.TopCategoriesChart),
  { ssr: false, loading: chartLoading },
);

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
      return;
    }

    apiClient
      .get<PlatformAnalytics>('/admin/analytics')
      .then((res) => setData(res ?? null))
      .catch((err) => {
        const message =
          err instanceof ApiError ? err.message : 'Failed to load dashboard analytics';
        toast(message, 'error');
      })
      .finally(() => setIsLoading(false));
  }, [user, router, toast]);

  const handleExportCsv = () => {
    const link = document.createElement('a');
    link.href = apiClient.url('/admin/analytics/export');
    link.setAttribute('download', 'platform-analytics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user || user.role !== 'admin') return null;
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
      <AdminQuickLinks />

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
          sub={`${formatCompact(data.engagement.viewsThisMonth)} this month`}
        />
        <MetricCard
          icon={<DollarSign size={20} />}
          label="Total Tips"
          value={`${formatCompact(data.revenue.totalTips, { maximumFractionDigits: 2 })} XLM`}
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
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            User Growth (6 months)
          </h2>
          <UserGrowthChart data={data.trends.userGrowth} />
        </div>

        <div className="rounded-lg border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Worker Growth (6 months)
          </h2>
          <WorkerGrowthChart data={data.trends.workerGrowth} />
        </div>
      </div>

      {/* Top Categories Chart */}
      <div className="mb-8 rounded-lg border bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          Top Categories
        </h2>
        <TopCategoriesChart data={data.topCategories} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <RecentWorkersList workers={data.recentWorkers} />
        <RecentUsersList users={data.recentUsers} />
      </div>
    </div>
  );
}
