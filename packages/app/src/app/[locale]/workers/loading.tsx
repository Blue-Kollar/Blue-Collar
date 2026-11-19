import { Skeleton, WorkerCardSkeleton } from "@/components/Skeleton";

export default function WorkersLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Skeleton className="mb-8 h-8 w-40" />
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar skeleton */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="flex flex-col gap-5 rounded-xl border bg-white p-5 shadow-sm">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </aside>

        {/* Search bar skeleton */}
        <div className="flex-1">
          <Skeleton className="mb-4 h-10 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <WorkerCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}