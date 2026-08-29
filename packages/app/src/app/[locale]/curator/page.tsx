"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ListingsTable } from "@/components/Curator/ListingsTable";
import type { CuratorWorker } from "@/components/Curator/ListingsTable";
import ErrorState from "@/components/ErrorState";
import { useMyWorkers, useToggleWorker, useDeleteWorker } from "@/hooks/queries";

export default function CuratorConsolePage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [deleteTarget, setDeleteTarget] = useState<CuratorWorker | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "curator" && user.role !== "admin"))) {
      router.replace("/auth/login");
    }
  }, [user, authLoading, router]);

  const workersQuery = useMyWorkers();
  const workers = (workersQuery.data?.data ?? []) as CuratorWorker[];
  const loading = workersQuery.isLoading;
  const error = workersQuery.isError ? "Something went wrong" : null;

  const toggleWorker = useToggleWorker();
  const toggling = toggleWorker.isPending ? new Set([toggleWorker.variables as string]) : new Set<string>();

  const deleteWorker = useDeleteWorker();

  const handleToggle = (worker: CuratorWorker) => {
    toggleWorker.mutate(worker.id);
  };

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteWorker.mutate(deleteTarget.id);
    setDeleteTarget(null);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Curator Console</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your worker listings and monitor on-chain status.
          </p>
        </div>
        <Link
          href="/curator/new"
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 transition-colors"
        >
          <Plus size={16} />
          New Listing
        </Link>
      </div>

      {error && <ErrorState variant="inline" message={error} className="mb-4" />}

      {/* Listings */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden">
        <ListingsTable
          workers={workers}
          loading={loading}
          onToggle={handleToggle}
          onDelete={setDeleteTarget}
          toggling={toggling}
        />
      </div>

      {/* Delete confirmation dialog */}
      <Dialog.Root open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-gray-900 p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/30">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div className="flex-1">
                <Dialog.Title className="font-semibold text-gray-900 dark:text-gray-100">
                  Delete listing?
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  This will permanently remove{" "}
                  <strong className="text-gray-700 dark:text-gray-300">{deleteTarget?.name}</strong>. This cannot be undone.
                </Dialog.Description>
              </div>
              <Dialog.Close className="rounded p-1 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </Dialog.Close>
            </div>
            <div className="mt-5 flex gap-3">
              <Dialog.Close className="flex-1 rounded-lg border dark:border-gray-700 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </Dialog.Close>
              <button
                onClick={handleDelete}
                disabled={deleteWorker.isPending}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleteWorker.isPending && <Loader2 size={14} className="animate-spin" />}
                Delete
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
