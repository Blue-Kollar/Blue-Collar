"use client";

import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

export type DashboardTabType = "workers" | "analytics";

interface DashboardTabsProps {
  activeTab: DashboardTabType;
  onTabChange: (tab: DashboardTabType) => void;
}

export function DashboardTabs({ activeTab, onTabChange }: DashboardTabsProps) {
  return (
    <div className="mb-6 flex gap-1 rounded-lg bg-gray-100 p-1">
      <button
        onClick={() => onTabChange("workers")}
        className={cn(
          "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          activeTab === "workers"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        Workers
      </button>
      <button
        onClick={() => onTabChange("analytics")}
        className={cn(
          "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
          activeTab === "analytics"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        )}
      >
        <span className="flex items-center justify-center gap-1.5">
          <BarChart3 size={14} />
          Analytics
        </span>
      </button>
    </div>
  );
}
