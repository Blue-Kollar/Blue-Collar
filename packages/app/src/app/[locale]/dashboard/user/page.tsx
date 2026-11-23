'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWallet } from '@/hooks/useWallet';
import { UserDashboardHeader } from '@/components/dashboard/user/UserDashboardHeader';
import { UserDashboardTabs } from '@/components/dashboard/user/UserDashboardTabs';
import { UserDashboardContent } from '@/components/dashboard/user/UserDashboardContent';
import type { UserDashboardTab } from '@/components/dashboard/user/UserDashboardTabs';
import type { ActivityItem } from '@/components/Dashboard/ActivityTimeline';
import type { AppNotification } from '@/types';
import {
  useNotifications,
  useBookmarks,
  useConversations,
  useToggleBookmark,
} from '@/hooks/queries';

function notificationsToActivity(items: AppNotification[]): ActivityItem[] {
  return items.map((n) => ({
    id: n.id,
    type: (n.type === 'tip'
      ? 'tip'
      : n.type === 'review'
        ? 'review'
        : n.type === 'message'
          ? 'message'
          : 'bookmark') as ActivityItem['type'],
    title: n.title,
    description: n.message ?? undefined,
    createdAt: n.createdAt,
    href: n.href ?? undefined,
  }));
}

export default function UserDashboardPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const { isConnected } = useWallet();
  const router = useRouter();
  const [tab, setTab] = useState<UserDashboardTab>('activity');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/auth/login');
  }, [user, authLoading, router]);

  const notificationsQuery = useNotifications({ limit: 20 });
  const activity: ActivityItem[] = notificationsToActivity(
    (notificationsQuery.data?.data ?? []) as AppNotification[],
  );

  const bookmarksQuery = useBookmarks();
  const savedWorkers = bookmarksQuery.data?.data ?? [];

  const conversationsQuery = useConversations({ limit: 5 });
  const conversations = conversationsQuery.data?.data ?? [];

  const loading =
    notificationsQuery.isLoading || bookmarksQuery.isLoading || conversationsQuery.isLoading;

  const toggleBookmark = useToggleBookmark();
  const removeBookmark = (workerId: string) => {
    toggleBookmark.mutate(workerId);
  };

  if (authLoading || (!user && !authLoading)) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={28} className="animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <UserDashboardHeader firstName={user!.firstName} walletConnected={isConnected} />

      <UserDashboardTabs activeTab={tab} onChange={setTab} />

      <UserDashboardContent
        tab={tab}
        loading={loading}
        activity={activity}
        savedWorkers={savedWorkers}
        onRemoveBookmark={removeBookmark}
        conversations={conversations}
        currentUserId={user!.id}
        user={user!}
        token={token!}
      />
    </div>
  );
}
