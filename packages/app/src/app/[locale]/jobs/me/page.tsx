"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useWallet } from "@/hooks/useWallet";
import { getMyPostedJobs, deleteJob, renewJob } from "@/lib/api/jobs";
import type { Job, Meta } from "@/types";
import { MyJobCard } from "@/components/jobs/me/MyJobCard";
import { MyJobsEmptyState } from "@/components/jobs/me/MyJobsEmptyState";
import { MyJobsSkeleton } from "@/components/jobs/me/MyJobsSkeleton";
import { MyJobsPagination } from "@/components/jobs/me/MyJobsPagination";

export default function MyJobsPage() {
  const { user } = useAuth();
  const { isConnected } = useWallet();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user && !isConnected) router.replace("/auth/login");
  }, [user, isConnected, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyPostedJobs({ page, limit: 10 });
      setJobs(res.data ?? []);
      setMeta(res.meta ?? null);
    } catch {/* ignore */}
    finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleRenew = async (id: string) => {
    setRenewingId(id);
    try {
      const res = await renewJob(id, 30);
      setJobs((prev) => prev.map((j) => j.id === id ? res.data : j));
    } catch {/* ignore */}
    finally { setRenewingId(null); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this job? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteJob(id);
      setJobs((prev) => prev.filter((j) => j.id !== id));
    } catch {/* ignore */}
    finally { setDeletingId(null); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Posted Jobs</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage your job postings and review applicants</p>
        </div>
        <Link
          href="/jobs/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={15} /> Post a Job
        </Link>
      </div>

      {loading ? (
        <MyJobsSkeleton />
      ) : jobs.length === 0 ? (
        <MyJobsEmptyState />
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <MyJobCard
              key={job.id}
              job={job}
              renewing={renewingId === job.id}
              deleting={deletingId === job.id}
              onRenew={handleRenew}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {meta && meta.pages > 1 && (
        <MyJobsPagination
          page={page}
          pages={meta.pages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
