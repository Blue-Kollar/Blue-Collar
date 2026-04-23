import { DashboardTableSkeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-36 animate-pulse rounded-md bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-48 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
        </div>
        <div className="h-10 w-40 animate-pulse rounded-lg bg-gray-200 dark:bg-gray-700" />
      </div>
      <DashboardTableSkeleton />
    </div>
  );
}
