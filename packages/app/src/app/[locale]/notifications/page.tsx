"use client";

import LoadingState from "@/components/LoadingState";
import { useEffect, useState } from "react";
import { Bell, CheckCheck, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useNotifications } from "@/context/NotificationContext";
import { deleteNotification } from "@/lib/api";
import { NotificationItem } from "@/components/notifications/NotificationItem";
import { NotificationEmptyState } from "@/components/notifications/NotificationEmptyState";

export default function NotificationCentrePage() {
  const { notifications, unreadCount, markRead, markAllRead, refresh, loading } =
    useNotifications();
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (id: string) => {
    setDeleting((prev) => new Set(prev).add(id));
    try {
      await deleteNotification(id);
      refresh();
    } catch {
      // silently fail
    } finally {
      setDeleting((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-600 dark:bg-red-900/30 dark:text-red-400">
              {unreadCount} unread
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
          >
            <CheckCheck size={15} />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState variant="list" />
      ) : notifications.length === 0 ? (
        <NotificationEmptyState icon={Bell} message="No notifications yet" />
      ) : (
        <div className="divide-y rounded-xl border dark:divide-gray-800 dark:border-gray-800">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              deleting={deleting.has(n.id)}
              onMarkRead={markRead}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}