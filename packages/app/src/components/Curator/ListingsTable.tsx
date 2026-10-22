"use client";

import Link from "next/link";
import { Pencil, Trash2, ToggleLeft, ToggleRight, ExternalLink, Loader2 } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import LoadingState from "@/components/LoadingState";

export interface CuratorWorker {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  category: { id: string; name: string };
  onChainStatus?: "registered" | "pending" | "unregistered";
  ttlDaysLeft?: number;
}

interface Props {
  workers: CuratorWorker[];
  loading?: boolean;
  onToggle: (worker: CuratorWorker) => void;
  onDelete: (worker: CuratorWorker) => void;
  toggling?: Set<string>;
}

function OnChainBadge({ status, ttlDaysLeft }: { status?: string; ttlDaysLeft?: number }) {
  if (!status || status === "unregistered") {
    return (
      <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] font-medium text-gray-500">
        Off-chain
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-[11px] font-medium text-yellow-700 dark:text-yellow-400">
        Pending
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        ttlDaysLeft != null && ttlDaysLeft < 30
          ? "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
          : "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
      )}
    >
      On-chain{ttlDaysLeft != null ? ` · ${ttlDaysLeft}d TTL` : ""}
    </span>
  );
}

export function ListingsTable({ workers, loading, onToggle, onDelete, toggling }: Props) {
  if (loading) {
    return <LoadingState className="py-20" />;
  }

  if (workers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-sm text-gray-400">
        <p className="font-medium">No listings yet.</p>
        <p className="mt-1">Create your first worker listing to get started.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm" aria-label="Worker listings">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">On-chain</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {workers.map((w) => (
              <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                <td className="px-5 py-4 font-medium text-gray-900 dark:text-gray-100">
                  {w.name}
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-brand-50 dark:bg-brand-900/20 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-400">
                    {w.category.name}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    w.isActive
                      ? "bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500"
                  )}>
                    {w.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <OnChainBadge status={w.onChainStatus} ttlDaysLeft={w.ttlDaysLeft} />
                </td>
                <td className="px-5 py-4 text-gray-400 dark:text-gray-500">
                  {formatDate(w.createdAt)}
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/workers/${w.id}`}
                      target="_blank"
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-brand-600 transition-colors"
                      title="View public profile"
                    >
                      <ExternalLink size={14} />
                    </Link>
                    <Link
                      href={`/curator/${w.id}/edit`}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-brand-600 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </Link>
                    <button
                      type="button"
                      onClick={() => onToggle(w)}
                      disabled={toggling?.has(w.id)}
                      title={w.isActive ? "Deactivate" : "Activate"}
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-brand-600 transition-colors disabled:opacity-50"
                    >
                      {toggling?.has(w.id) ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : w.isActive ? (
                        <ToggleRight size={16} className="text-green-500" />
                      ) : (
                        <ToggleLeft size={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(w)}
                      title="Delete"
                      className="rounded p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked */}
      <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-700 sm:hidden">
        {workers.map((w) => (
          <div key={w.id} className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{w.name}</p>
                <p className="text-xs text-gray-500">{w.category.name}</p>
              </div>
              <div className="flex gap-1">
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  w.isActive ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"
                )}>
                  {w.isActive ? "Active" : "Inactive"}
                </span>
                <OnChainBadge status={w.onChainStatus} ttlDaysLeft={w.ttlDaysLeft} />
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/curator/${w.id}/edit`} className="flex-1 rounded-lg border dark:border-gray-700 py-1.5 text-center text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                Edit
              </Link>
              <button type="button" onClick={() => onToggle(w)} disabled={toggling?.has(w.id)} className="flex-1 rounded-lg border dark:border-gray-700 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">
                {w.isActive ? "Deactivate" : "Activate"}
              </button>
              <button type="button" onClick={() => onDelete(w)} className="flex-1 rounded-lg border border-red-200 dark:border-red-900/50 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
