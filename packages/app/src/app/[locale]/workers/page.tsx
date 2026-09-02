import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkerCardSkeleton } from "@/components/Skeleton";
import WorkersDiscovery from "@/components/WorkersDiscovery";

export const metadata: Metadata = {
  title: "Browse Workers",
  description:
    "Find skilled tradespeople near you — plumbers, electricians, carpenters and more.",
  openGraph: {
    title: "Browse Workers | BlueCollar",
    description: "Find skilled tradespeople near you.",
  },
};

function DiscoveryFallback() {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      {/* Sidebar skeleton */}
      <aside className="hidden w-60 shrink-0 lg:block">
        <div className="flex flex-col gap-5 rounded-xl border bg-white p-5 shadow-sm">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
              <div className="h-9 w-full animate-pulse rounded-md bg-gray-200" />
            </div>
          ))}
        </div>
      </aside>
      {/* Grid skeleton */}
      <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <WorkerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export default function WorkersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="mb-8 text-2xl font-bold text-gray-800">Browse Workers</h1>
      <Suspense fallback={<DiscoveryFallback />}>
        <WorkersDiscovery />
      </Suspense>
    </div>
  );
}
