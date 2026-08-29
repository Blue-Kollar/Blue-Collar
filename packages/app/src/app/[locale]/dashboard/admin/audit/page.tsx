"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { useAuditLogs } from "@/hooks/queries";
import { formatDate } from "@/lib/utils";

export default function AdminAuditLogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");

  const params: Record<string, string> = { page: String(page), limit: "50" };
  if (filterAction) params.action = filterAction;

  const logsQuery = useAuditLogs(params);
  const logs = logsQuery.data?.data ?? [];
  const loading = logsQuery.isLoading;
  const meta = logsQuery.data?.meta ?? null;

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
    }
  }, [user, router]);

  useEffect(() => {
    if (logsQuery.isError) toast("Failed to load audit logs", "error");
  }, [logsQuery.isError, toast]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/admin"
            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
        </div>
        <input
          type="text"
          value={filterAction}
          onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
          placeholder="Filter by action..."
          className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <ClipboardList size={40} className="opacity-30" />
          <p className="text-sm">No audit log entries found</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Resource ID</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800 font-mono text-xs">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-gray-400">
                      {formatDate(new Date(log.createdAt), {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {log.user ? `${log.user.firstName} ${log.user.lastName}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{log.resource ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{log.resourceId ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
              <span>Page {page} of {meta.pages}</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= meta.pages}
                  onClick={() => setPage(page + 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
