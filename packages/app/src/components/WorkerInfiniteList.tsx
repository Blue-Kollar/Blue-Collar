"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, ArrowUp } from "lucide-react";
import WorkerCard from "@/components/WorkerCard";
import EmptyState from "@/components/EmptyState";
import type { Worker, Meta } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface Props {
  initialWorkers: Worker[];
  initialMeta: Meta | null;
  params: Record<string, string>;
}

export default function WorkerInfiniteList({ initialWorkers, initialMeta, params }: Props) {
  const [workers, setWorkers] = useState<Worker[]>(initialWorkers);
  const [meta, setMeta] = useState<Meta | null>(initialMeta);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const currentPage = useRef(initialMeta?.page ?? 1);
  const hasMore = meta ? meta.page < meta.pages : false;

  // Reset when filters change (params change means new search)
  useEffect(() => {
    setWorkers(initialWorkers);
    setMeta(initialMeta);
    currentPage.current = initialMeta?.page ?? 1;
    setError(null);
  }, [initialWorkers, initialMeta]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const nextPage = currentPage.current + 1;
      const qs = new URLSearchParams({ ...params, page: String(nextPage), limit: "20" }).toString();
      const res = await fetch(`${API}/workers?${qs}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load workers");
      const json = await res.json();
      setWorkers((prev) => [...prev, ...(json.data as Worker[])]);
      setMeta(json.meta ?? null);
      currentPage.current = nextPage;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, params]);

  // Intersection observer for sentinel
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  // Back to top visibility
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const hasFilters = Object.keys(params).some(
    (k) => k !== "page" && k !== "limit" && params[k]
  );

  if (workers.length === 0 && !loading) {
    return (
      <EmptyState
        variant={hasFilters ? "no-search-results" : "no-workers"}
        ctaHref="/workers"
      />
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {workers.map((w) => (
          <WorkerCard key={w.id} worker={w} />
        ))}
      </div>

      {/* Sentinel + loading indicator */}
      <div ref={sentinelRef} className="mt-8 flex justify-center">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 size={18} className="animate-spin" />
            Loading more workers…
          </div>
        )}
        {!loading && !hasMore && workers.length > 0 && (
          <p className="text-sm text-gray-400">You've seen all workers</p>
        )}
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-center text-sm text-red-600">
          {error}{" "}
          <button onClick={loadMore} className="underline hover:no-underline">
            Try again
          </button>
        </div>
      )}

      {/* Back to top */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          aria-label="Back to top"
          className="fixed bottom-20 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-opacity hover:bg-blue-700 md:bottom-6"
        >
          <ArrowUp size={18} />
        </button>
      )}
    </>
  );
}
