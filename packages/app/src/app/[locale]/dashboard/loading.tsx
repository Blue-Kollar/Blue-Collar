import { DashboardTableSkeleton, Skeleton } from "@/components/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
      <DashboardTableSkeleton />
    </div>
  );
}