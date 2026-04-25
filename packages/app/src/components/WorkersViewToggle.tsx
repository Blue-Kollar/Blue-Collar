"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, Map } from "lucide-react";
import type { Worker } from "@/types";
import WorkerCard from "@/components/WorkerCard";
import EmptyState from "@/components/EmptyState";
import { cn } from "@/lib/utils";

// Load map only client-side (Leaflet requires window)
const WorkerMap = dynamic(() => import("@/components/WorkerMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[500px] items-center justify-center rounded-xl border bg-gray-50">
      <div className="h-8 w-8 rounded-full border-2 border-blue-200 border-t-blue-600 animate-spin" />
    </div>
  ),
});

interface Props {
  workers: Worker[];
  hasFilters: boolean;
}

type View = "list" | "map";

export default function WorkersViewToggle({ workers, hasFilters }: Props) {
  const [view, setView] = useState<View>("list");

  return (
    <div className="flex-1">
      {/* Toggle */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {workers.length} worker{workers.length !== 1 ? "s" : ""} found
        </p>
        <div className="flex items-center rounded-lg border bg-white p-1 gap-1 shadow-sm">
          <button
            onClick={() => setView("list")}
            aria-label="List view"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "list"
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            <LayoutGrid size={15} />
            List
          </button>
          <button
            onClick={() => setView("map")}
            aria-label="Map view"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              view === "map"
                ? "bg-blue-600 text-white"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            <Map size={15} />
            Map
          </button>
        </div>
      </div>

      {/* Content */}
      {view === "list" ? (
        workers.length === 0 ? (
          <EmptyState
            variant={hasFilters ? "no-search-results" : "no-workers"}
            ctaHref="/workers"
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workers.map((w) => (
              <WorkerCard key={w.id} worker={w} />
            ))}
          </div>
        )
      ) : (
        <div className="h-[500px]">
          <WorkerMap workers={workers} />
        </div>
      )}
    </div>
  );
}
