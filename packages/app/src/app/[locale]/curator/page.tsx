"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ListingsTable } from "@/components/Curator/ListingsTable";
import type { CuratorWorker } from "@/components/Curator/ListingsTable";
import ErrorState from "@/components/ErrorState";
import { useMyWorkers, useToggleWorker, useDeleteWorker } from "@/hooks/queries";
import { CuratorConsoleHeader } from "@/components/curator/CuratorConsoleHeader";
import { DeleteListingDialog } from "@/components/curator/DeleteListingDialog";

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
  const workers = (workersQuery.data?.data ?? []) as unknown as CuratorWorker[];
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
      <CuratorConsoleHeader />

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

      <DeleteListingDialog
        target={deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        onConfirm={handleDelete}
        isPending={deleteWorker.isPending}
      />
    </div>
  );
}
