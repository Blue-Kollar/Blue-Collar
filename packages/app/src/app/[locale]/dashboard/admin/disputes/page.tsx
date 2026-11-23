'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Scale } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDisputes, useResolveDispute } from '@/hooks/queries';
import LoadingState from '@/components/LoadingState';
import DisputeCard from '@/components/dashboard/admin/disputes/DisputeCard';
import DisputesPagination from '@/components/dashboard/admin/disputes/DisputesPagination';

export default function AdminDisputesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [page, setPage] = useState(1);

  const disputesQuery = useDisputes({ page: String(page), limit: '20' });
  const disputes = disputesQuery.data?.data ?? [];
  const loading = disputesQuery.isLoading;
  const meta = disputesQuery.data?.meta ?? null;

  const resolveDispute = useResolveDispute();
  const actionLoading = resolveDispute.isPending ? (resolveDispute.variables?.id ?? null) : null;

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (disputesQuery.isError) toast('Failed to load disputes', 'error');
  }, [disputesQuery.isError, toast]);

  const handleResolve = (id: string, status: string) => {
    resolveDispute.mutate(
      { id, status, resolution: `Resolved by admin as ${status}` },
      {
        onSuccess: () =>
          toast(
            `Dispute ${status === 'resolved' ? 'resolved' : status === 'dismissed' ? 'dismissed' : 'moved to review'}`,
            'success',
          ),
        onError: () => toast('Failed to update dispute', 'error'),
      },
    );
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/admin"
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Dispute Review</h1>
      </div>

      {loading ? (
        <LoadingState className="py-12" />
      ) : disputes.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <Scale size={40} className="opacity-30" />
          <p className="text-sm">No disputes found</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {disputes.map((d) => (
              <DisputeCard
                key={d.id}
                dispute={d}
                actionLoading={actionLoading === d.id}
                onResolve={handleResolve}
              />
            ))}
          </div>

          {meta && meta.pages > 1 && (
            <DisputesPagination page={page} totalPages={meta.pages} onPageChange={setPage} />
          )}
        </>
      )}
    </div>
  );
}
