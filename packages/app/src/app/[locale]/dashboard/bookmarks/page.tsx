"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getMyBookmarks } from "@/lib/api";
import WorkerCard from "@/components/WorkerCard";
import EmptyState from "@/components/EmptyState";
import { BookmarksSkeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import type { Worker } from "@/types";

export default function SavedWorkersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    getMyBookmarks()
      .then((res) => setWorkers(res.data))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load bookmarks")
      )
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (authLoading || loading) {
    return <BookmarksSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Bookmark size={22} className="text-blue-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Saved Workers</h1>
          <p className="mt-0.5 text-sm text-gray-500">Workers you&apos;ve bookmarked</p>
        </div>
      </div>

      {error && <ErrorState variant="inline" message={error} className="mb-6" />}

      {workers.length === 0 ? (
        <EmptyState variant="no-bookmarks" />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {workers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </div>
  );
}
