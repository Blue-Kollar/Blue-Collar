import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export default function Skeleton({ className }: Props) {
  return (
    <div className={cn("animate-pulse rounded-md bg-gray-200 dark:bg-gray-700", className)} />
  );
}

export function WorkerCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-auto h-8 w-full rounded-md" />
    </div>
  );
}

export function WorkerProfileSkeleton() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Skeleton className="mb-6 h-4 w-28" />
      <div className="rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-8 shadow-sm">
        <div className="flex items-center gap-5">
          <Skeleton className="h-20 w-20 rounded-full shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-24 rounded-full" />
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
          <Skeleton className="h-3 w-4/6" />
        </div>
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="mt-8 border-t dark:border-gray-800 pt-6 flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export function DashboardTableSkeleton() {
  return (
    <div className="rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 px-5 py-3.5 flex gap-8">
        {["w-16", "w-20", "w-14", "w-20", "w-12"].map((w, i) => (
          <Skeleton key={i} className={`h-3 ${w}`} />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-8 px-5 py-4 border-b last:border-b-0 dark:border-gray-800">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CategoryGridSkeleton() {
  return (
    <section className="px-4 py-12">
      <Skeleton className="mx-auto mb-8 h-7 w-48" />
      <div className="mx-auto max-w-6xl grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-2 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Skeleton className="mb-8 h-8 w-52" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-800 p-6">
            <Skeleton className="h-4 w-28 mb-3" />
            <Skeleton className="h-9 w-16" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-800 p-6 mb-8">
        <Skeleton className="h-5 w-36 mb-4" />
        <Skeleton className="h-64 w-full rounded-md" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border bg-white dark:bg-gray-900 dark:border-gray-800 p-6">
            <Skeleton className="h-5 w-48 mb-4" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex justify-between py-3 border-b last:border-b-0 dark:border-gray-800">
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookmarksSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Skeleton className="h-6 w-6 rounded" />
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <WorkerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
