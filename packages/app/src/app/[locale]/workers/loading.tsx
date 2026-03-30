import { WorkerCardSkeleton } from "@/components/Skeleton";

export default function WorkersLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-8 h-8 w-40 animate-pulse rounded-md bg-gray-200" />
      <div className="flex flex-col gap-8 lg:flex-row">
        {/* Sidebar skeleton */}
        <aside className="w-full shrink-0 lg:w-60">
          <div className="flex flex-col gap-5 rounded-xl border bg-white p-5 shadow-sm">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
                <div className="h-9 w-full animate-pulse rounded-md bg-gray-200" />
              </div>
            ))}
            <div className="h-9 w-full animate-pulse rounded-md bg-gray-200" />
          </div>
        </aside>

        {/* Grid skeleton */}
        <div className="flex-1 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <WorkerCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
