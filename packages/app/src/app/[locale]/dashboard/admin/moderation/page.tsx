'use client';

import LoadingState from '@/components/LoadingState';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/useToast';
import { useModerationQueue, useModerateReview } from '@/hooks/queries';
import ModerationReviewCard from '@/components/dashboard/admin/moderation/ModerationReviewCard';

export default function AdminModerationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const queueQuery = useModerationQueue();
  const reviews = queueQuery.data?.data ?? [];
  const loading = queueQuery.isLoading;

  const moderateReview = useModerateReview();
  const actionLoading = moderateReview.isPending
    ? (moderateReview.variables?.reviewId ?? null)
    : null;

  useEffect(() => {
    if (user && user.role !== 'admin') {
      router.push('/');
    }
  }, [user, router]);

  useEffect(() => {
    if (queueQuery.isError) toast('Failed to load moderation queue', 'error');
  }, [queueQuery.isError, toast]);

  const handleModerate = (reviewId: string, action: 'approve' | 'reject') => {
    moderateReview.mutate(
      { reviewId, action },
      {
        onSuccess: () => toast(`Review ${action}d`, 'success'),
        onError: () => toast('Failed to moderate review', 'error'),
      },
    );
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/admin"
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Moderation Queue</h1>
      </div>

      {loading ? (
        <LoadingState variant="list" />
      ) : reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <Search size={40} className="opacity-30" />
          <p className="text-sm">No reviews pending moderation</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ModerationReviewCard
              key={review.id}
              review={review}
              isActionLoading={actionLoading === review.id}
              onModerate={handleModerate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
