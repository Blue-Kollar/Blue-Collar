'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuditLogs } from '@/hooks/queries';
import { AuditLogTable } from '@/components/dashboard/admin/audit/AuditLogTable';
import { AuditLogPagination } from '@/components/dashboard/admin/audit/AuditLogPagination';

export default function AdminAuditLogPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState('');

  const params: Record<string, string> = { page: String(page), limit: '50' };
  if (filterAction) params.action = filterAction;

  const logsQuery = useAuditLogs(params);
  const logs = logsQuery.data?.data ?? [];
  const loading = logsQuery.isLoading;
  const meta = logsQuery.data?.meta ?? null;

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (logsQuery.isError) toast('Failed to load audit logs', 'error');
  }, [logsQuery.isError, toast]);

  if (!user || user.role !== 'admin') return null;

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
          onChange={(e) => {
            setFilterAction(e.target.value);
            setPage(1);
          }}
          placeholder="Filter by action..."
          className="rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
      </div>

      <AuditLogTable logs={logs} loading={loading} />

      {meta && meta.pages > 1 && (
        <AuditLogPagination
          page={page}
          totalPages={meta.pages}
          onPrevious={() => setPage(page - 1)}
          onNext={() => setPage(page + 1)}
        />
      )}
    </div>
  );
}
