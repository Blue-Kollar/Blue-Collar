"use client";

import { ArrowLeft,Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { useNotifications } from "@/context/NotificationContext";
import { deleteNotification } from "@/lib/api";
import { cn, formatRelativeTime } from "@/lib/utils";
import type { NotificationType as NType } from "@/types";
type NotificationType = NType;

const TYPE_STYLES: Record<NotificationType, string> = {
  tip: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  review: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  contact: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  system: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  message: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const TYPE_LABELS: Record<NotificationType, string> = {
  tip: "Tip",
  review: "Review",
  contact: "Contact",
  system: "System",
  message: "Message",
};


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
        <div className="flex justify-center py-20">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
          <Bell size={40} className="opacity-30" />
          <p className="text-sm">No notifications yet</p>
        </div>
      ) : (
        <div className="divide-y rounded-xl border dark:divide-gray-800 dark:border-gray-800">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-4 px-5 py-4 transition-colors",
                !n.read && "bg-blue-50/60 dark:bg-blue-950/30"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                  TYPE_STYLES[n.type as NotificationType]
                )}
              >
                {TYPE_LABELS[n.type as NotificationType]}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => markRead(n.id)}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {n.title}
                      </p>
                    )}
                    {n.message && (
                      <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                        {n.message}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="flex h-7 w-7 items-center justify-center rounded text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                        title="Mark as read"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(n.id)}
                      disabled={deleting.has(n.id)}
                      className="flex h-7 w-7 items-center justify-center rounded text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-xs text-gray-400">{formatRelativeTime(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
