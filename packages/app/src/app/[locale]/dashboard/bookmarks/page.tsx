'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiClient } from '@/lib/apiClient';
import { BookmarksSkeleton } from '@/components/Skeleton';
import { BookmarksHeader, BookmarksList } from '@/components/dashboard/bookmarks';
import type { Worker } from '@/types';

export default function SavedWorkersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    apiClient
      .getMyBookmarks()
      .then((res) => setWorkers(res.data ?? []))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load bookmarks'),
      )
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  if (authLoading || loading) {
    return <BookmarksSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <BookmarksHeader />
      <BookmarksList workers={workers} error={error} />
    </div>
  );
}
