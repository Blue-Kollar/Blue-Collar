"use client";

import Link from "next/link";
import { Plus, Settings } from "lucide-react";

interface DashboardHeaderProps {
  title?: string;
  subtitle?: string;
  createWorkerHref?: string;
  settingsHref?: string;
}

export function DashboardHeader({
  title = "My Workers",
  subtitle = "Manage your worker listings and track performance",
  createWorkerHref = "/dashboard/workers/new",
  settingsHref = "/dashboard/settings",
}: DashboardHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href={createWorkerHref}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Create New Worker
        </Link>
        <Link
          href={settingsHref}
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          title="Settings"
        >
          <Settings size={16} />
        </Link>
      </div>
    </div>
  );
}
