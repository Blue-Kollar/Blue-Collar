"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, Plus, Briefcase } from "lucide-react";
import { getCategories } from "@/lib/api";
import { getJobs } from "@/lib/api/jobs";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import JobCard from "@/components/JobCard";
import ErrorState from "@/components/ErrorState";
import type { Job, Category, Meta } from "@/types";

export default function JobsPage() {
  const { user } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [urgency, setUrgency] = useState("");
  const [page, setPage] = useState(1);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getJobs({ search: search || undefined, categoryId: categoryId || undefined, urgency: urgency || undefined, page, limit: 12 });
      setJobs(res.data);
      setMeta(res.meta ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, urgency, page]);

  useEffect(() => {
    getCategories().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, categoryId, urgency]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Job Board</h1>
          <p className="mt-0.5 text-sm text-gray-500">Find skilled-work opportunities near you</p>
        </div>
        {user && (
          <Link
            href="/jobs/new"
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={16} /> Post a Job
          </Link>
        )}
      </div>

      {/* Search and Filters */}
      <div className="mb-6">
        <SearchFilters
          search={search}
          onSearchChange={setSearch}
          categoryId={categoryId}
          onCategoryChange={setCategoryId}
          urgency={urgency}
          onUrgencyChange={setUrgency}
          categories={categories}
        />
      </div>

      {/* Job grid */}
      {error && <ErrorState variant="inline" message={error} className="mb-6" />}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Briefcase size={40} className="mb-4 text-gray-300" />
          <p className="font-medium text-gray-500">No jobs found</p>
          <p className="mt-1 text-sm text-gray-400">Try adjusting your search or filters</p>
          {user && (
            <Link href="/jobs/new" className="mt-5 flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              <Plus size={15} /> Post the first job
            </Link>
          )}
        </div>
      ) : (
        <ul aria-label="Job listings" className="grid list-none gap-4 p-0 sm:grid-cols-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {meta && meta.pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {meta.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
            disabled={page === meta.pages}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
