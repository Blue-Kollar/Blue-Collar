"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface DashboardWorker {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  category: { id: string; name: string };
}

export default function DashboardPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [workers, setWorkers] = useState<DashboardWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DashboardWorker | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Redirect if not curator/admin
  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "curator" && user.role !== "admin"))) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  const fetchWorkers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/workers/mine`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load workers");
      const json = await res.json();
      setWorkers(json.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!authLoading && token) fetchWorkers();
  }, [authLoading, token, fetchWorkers]);

  // ── Toggle active/inactive (optimistic) ──────────────────────────────────
  const handleToggle = async (worker: DashboardWorker) => {
    // Optimistic update
    setWorkers((prev: DashboardWorker[]) =>
      prev.map((w: DashboardWorker) => (w.id === worker.id ? { ...w, isActive: !w.isActive } : w))
    );
    try {
      const res = await fetch(`${API}/workers/${worker.id}/toggle`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Toggle failed");
    } catch {
      // Revert on failure
      setWorkers((prev: DashboardWorker[]) =>
        prev.map((w: DashboardWorker) => (w.id === worker.id ? { ...w, isActive: worker.isActive } : w))
      );
    }
  };

  // ── Delete (optimistic) ───────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);

    // Optimistic remove
    setWorkers((prev: DashboardWorker[]) => prev.filter((w: DashboardWorker) => w.id !== target.id));
    setDeleteTarget(null);

    try {
      const res = await fetch(`${API}/workers/${target.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Delete failed");
    } catch {
      // Revert on failure
      setWorkers((prev: DashboardWorker[]) => [target, ...prev]);
    } finally {
      setDeleting(false);
    }
  };

  // ── Loading / auth guard ──────────────────────────────────────────────────
  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Workers</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Manage your worker listings
          </p>
        </div>
        <Link
          href="/dashboard/workers/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          Create New Worker
        </Link>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : workers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-gray-500 font-medium">No workers yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Create your first worker listing to get started.
            </p>
            <Link
              href="/dashboard/workers/new"
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus size={15} />
              Create Worker
            </Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <th className="px-5 py-3.5">Name</th>
                <th className="px-5 py-3.5">Category</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Created</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {workers.map((worker: DashboardWorker) => (
                <tr key={worker.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 font-medium text-gray-800">
                    {worker.name}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
                      {worker.category.name}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-medium",
                        worker.isActive
                          ? "bg-green-50 text-green-600"
                          : "bg-gray-100 text-gray-500"
                      )}
                    >
                      {worker.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-400">
                    {new Date(worker.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <Link
                        href={`/dashboard/workers/${worker.id}/edit`}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </Link>

                      {/* Toggle */}
                      <button
                        onClick={() => handleToggle(worker)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-blue-600 transition-colors"
                        title={worker.isActive ? "Deactivate" : "Activate"}
                      >
                        {worker.isActive ? (
                          <ToggleRight size={17} className="text-green-500" />
                        ) : (
                          <ToggleLeft size={17} />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => setDeleteTarget(worker)}
                        className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog.Root
        open={!!deleteTarget}
        onOpenChange={(open: boolean) => { if (!open) setDeleteTarget(null); }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50">
                  <AlertTriangle size={18} className="text-red-500" />
                </div>
                <div>
                  <Dialog.Title className="font-semibold text-gray-900">
                    Delete worker?
                  </Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-sm text-gray-500">
                    This will permanently remove{" "}
                    <span className="font-medium text-gray-700">
                      {deleteTarget?.name}
                    </span>
                    . This action cannot be undone.
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close className="rounded-md p-1 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </Dialog.Close>
            </div>

            <div className="mt-5 flex gap-3">
              <Dialog.Close className="flex-1 rounded-lg border py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
