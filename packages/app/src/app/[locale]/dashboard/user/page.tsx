"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Activity, Heart, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { ActivityTimeline } from "@/components/Dashboard/ActivityTimeline";
import { SavedWorkers } from "@/components/Dashboard/SavedWorkers";
import { MessagesPreview } from "@/components/Dashboard/MessagesPreview";
import { QuickProfileEdit } from "@/components/Dashboard/QuickProfileEdit";
import type { ActivityItem } from "@/components/Dashboard/ActivityTimeline";
import type { AppNotification } from "@/types";
import { useNotifications, useBookmarks, useConversations, useToggleBookmark } from "@/hooks/queries";

type Tab = "activity" | "saved" | "messages" | "profile";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "activity", label: "Activity", icon: <Activity size={15} /> },
  { id: "saved", label: "Saved Workers", icon: <Heart size={15} /> },
  { id: "messages", label: "Messages", icon: <MessageSquare size={15} /> },
  { id: "profile", label: "Profile", icon: <User size={15} /> },
];

function notificationsToActivity(items: AppNotification[]): ActivityItem[] {
  return items.map((n) => ({
    id: n.id,
    type: (n.type === "tip" ? "tip" : n.type === "review" ? "review" : n.type === "message" ? "message" : "bookmark") as ActivityItem["type"],
    title: n.title,
    description: n.message ?? undefined,
    createdAt: n.createdAt,
    href: n.href ?? undefined,
  }));
}

export default function UserDashboardPage() {
  const { user, token, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("activity");

  useEffect(() => {
    if (!authLoading && !user) router.replace("/auth/login");
  }, [user, authLoading, router]);

  const notificationsQuery = useNotifications({ limit: 20 });
  const activity: ActivityItem[] = notificationsToActivity(
    (notificationsQuery.data?.data ?? []) as AppNotification[]
  );

  const bookmarksQuery = useBookmarks();
  const savedWorkers = bookmarksQuery.data?.data ?? [];

  const conversationsQuery = useConversations({ limit: 5 });
  const conversations = conversationsQuery.data?.data ?? [];

  const loading = notificationsQuery.isLoading || bookmarksQuery.isLoading || conversationsQuery.isLoading;

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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome back, {user!.firstName}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Your activity, saved workers, and messages in one place.
        </p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 p-5">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {tab === "activity" && <ActivityTimeline items={activity} />}
            {tab === "saved" && (
              <SavedWorkers workers={savedWorkers} onRemove={removeBookmark} />
            )}
            {tab === "messages" && (
              <div>
                <MessagesPreview conversations={conversations} currentUserId={user!.id} />
                {conversations.length > 0 && (
                  <div className="mt-4 text-center">
                    <Link href="/messages" className="text-sm text-brand-600 hover:underline">
                      View all messages →
                    </Link>
                  </div>
                )}
              </div>
            )}
            {tab === "profile" && (
              <QuickProfileEdit user={user!} token={token!} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
