"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Briefcase, RefreshCw, Loader2, Clock, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getMyPostedJobs, deleteJob, renewJob } from "@/lib/api/jobs";
import { cn } from "@/lib/utils";
import type { Job, Meta } from "@/types";

const STATUS_STYLE: Record<string, string> = {
  open:    "bg-green-50 text-green-600",
  filled:  "bg-blue-50 text-blue-600",
  closed:  "bg-gray-100 text-gray-500",
  expired: "bg-yellow-50 text-yellow-600",
};

export default function MyJobsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [renewingId, setRenewingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) router.replace("/auth/login");
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getMyPostedJobs({ page, limit: 10 });
      setJobs(res.data);
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
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-24 text-center">
          <Briefcase size={40} className="mb-4 text-gray-300" />
          <p className="font-medium text-gray-500">No jobs posted yet</p>
          <Link href="/jobs/new" className="mt-4 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            <Plus size={14} /> Post your first job
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => {
            const daysLeft = job.expiresAt
              ? Math.max(0, Math.ceil((new Date(job.expiresAt).getTime() - Date.now()) / 86_400_000))
              : null;

            return (
              <div key={job.id} className="rounded-xl border bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/jobs/${job.id}`} className="truncate font-semibold text-gray-900 hover:text-blue-600">
                      {job.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">{job.category.name}</p>
                  </div>
                  <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[job.status])}>
                    {job.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Briefcase size={12} /> {job._count?.applications ?? 0} applicant{(job._count?.applications ?? 0) !== 1 ? "s" : ""}
                  </span>
                  {daysLeft !== null && (
                    <span className={cn("flex items-center gap-1", daysLeft <= 3 ? "text-red-500" : "")}>
                      <Clock size={12} /> {daysLeft === 0 ? "Expires today" : `${daysLeft}d left`}
                    </span>
                  )}
                  <span>{new Date(job.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/jobs/${job.id}`}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    View & Applicants
                  </Link>
                  <Link
                    href={`/jobs/${job.id}/edit`}
                    className="rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Edit
                  </Link>
                  {(job.status === "open" || job.status === "expired") && (
                    <button
                      onClick={() => handleRenew(job.id)}
                      disabled={renewingId === job.id}
                      className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {renewingId === job.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                      Renew
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === job.id ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.pages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50">
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {meta.pages}</span>
          <button onClick={() => setPage((p) => Math.min(meta.pages, p + 1))} disabled={page === meta.pages} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 disabled:opacity-40 hover:bg-gray-50">
            Next
          </button>
        </div>
      )}
    </div>
  );
}
