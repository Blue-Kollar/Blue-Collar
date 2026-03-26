import { cn } from "@/lib/utils";

interface Props {
  className?: string;
}

export default function Skeleton({ className }: Props) {
  return (
    <div className={cn("animate-pulse rounded-md bg-gray-200", className)} />
  );
}

export function WorkerCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-white p-5 shadow-sm">
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
      <div className="rounded-2xl border bg-white p-8 shadow-sm">
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
        <div className="mt-8 border-t pt-6 flex items-center justify-between">
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
