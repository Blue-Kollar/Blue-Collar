"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Bookmark } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getMyBookmarks } from "@/lib/api";
import WorkerCard from "@/components/WorkerCard";
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
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
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

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      {workers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bookmark size={36} className="text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium">No saved workers yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Tap the heart icon on any worker card to save them here.
          </p>
        </div>
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
