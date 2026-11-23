'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiClient } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import JobsFilters from '@/components/jobs/JobsFilters';
import JobsList from '@/components/jobs/JobsList';
import JobsPagination from '@/components/jobs/JobsPagination';
import ErrorState from '@/components/ErrorState';
import type { Job, Category, Meta } from '@/types';

// Sub-components live in @/components/jobs:
// - JobsFilters: search input, urgency select, category filters
// - JobsList: loading skeletons, empty state, job card grid
// - JobsPagination: previous/next pagination controls

export default function JobsPage() {
  const { user } = useAuth();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [urgency, setUrgency] = useState('');
  const [page, setPage] = useState(1);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getJobs({
        search: search || undefined,
        categoryId: categoryId || undefined,
        urgency: urgency || undefined,
        page,
        limit: 12,
      });
      setJobs(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  }, [search, categoryId, urgency, page]);

  useEffect(() => {
    apiClient
      .getCategories()
      .then((r) => setCategories(r.data ?? []))
      .catch(() => {});
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
      <JobsFilters
        search={search}
        onSearchChange={setSearch}
        urgency={urgency}
        onUrgencyChange={setUrgency}
        categories={categories.map((category) => ({ id: category.id, label: category.name }))}
        onCategoryChange={setCategoryId}
      />

      {/* Job grid */}
      {error && <ErrorState variant="inline" message={error} className="mb-6" />}

      <JobsList jobs={jobs} loading={loading} canPost={Boolean(user)} />

      {/* Pagination */}
      <JobsPagination page={page} meta={meta} onPageChange={setPage} />
    </div>
  );
}
