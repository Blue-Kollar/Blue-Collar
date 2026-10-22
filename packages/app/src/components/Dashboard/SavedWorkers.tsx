"use client";

import Image from "next/image";
import Link from "next/link";
import { Bookmark, Star } from "lucide-react";
import { WorkerCardSkeleton } from "@/components/Skeleton";
import type { Worker } from "@/types";

interface Props {
  workers: Pick<Worker, "id" | "name" | "avatar" | "category" | "averageRating" | "location">[];
  loading?: boolean;
  onRemove?: (id: string) => void;
}

export function SavedWorkers({ workers, loading, onRemove }: Props) {
  // ── Loading state (#1203) ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading saved workers">
        {Array.from({ length: 4 }).map((_, i) => (
          <WorkerCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // ── Empty state (#1203) ────────────────────────────────────────────────────
  if (workers.length === 0) {
    return (
      <div className="py-10 text-center">
        <Bookmark size={32} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-400">No saved workers yet.</p>
        <Link href="/workers" className="mt-3 inline-block text-sm text-brand-600 hover:underline">
          Browse workers
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {workers.map((w) => (
        <div
          key={w.id}
          className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-3"
        >
          {w.avatar ? (
            <Image
              src={w.avatar}
              alt={w.name}
              width={44}
              height={44}
              className="h-11 w-11 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 text-base font-bold">
              {w.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link
              href={`/workers/${w.id}`}
              className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline"
            >
              {w.name}
            </Link>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{w.category.name}</p>
            {w.averageRating != null && (
              <span className="inline-flex items-center gap-0.5 text-xs text-yellow-500">
                <Star size={11} fill="currentColor" />
                {w.averageRating.toFixed(1)}
              </span>
            )}
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={() => onRemove(w.id)}
              aria-label={`Remove ${w.name} from saved`}
              className="shrink-0 rounded-md p-1.5 text-gray-400 hover:text-red-500 transition-colors"
            >
              <Bookmark size={15} fill="currentColor" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
