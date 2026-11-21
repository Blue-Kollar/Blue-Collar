"use client";

import { useRef, useState, useEffect } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useNotifications } from "@/context/NotificationContext";
import type { NotificationType } from "@/types";
import { cn, formatRelativeTime } from "@/lib/utils";

const TYPE_STYLES: Record<NotificationType, string> = {
  tip: "bg-yellow-100 text-yellow-700",
  review: "bg-blue-100 text-blue-700",
  contact: "bg-green-100 text-green-700",
  system: "bg-gray-100 text-gray-600",
  message: "bg-purple-100 text-purple-700",
};

const TYPE_LABELS: Record<NotificationType, string> = {
  tip: "Tip",
  review: "Review",
  contact: "Contact",
  system: "System",
  message: "Message",
};


export default function NotificationDropdown() {
  const { notifications, unreadCount, markRead, markAllRead, clearAll } =
    useNotifications();
  const t = useTranslations("notifications");
  const componentT = useTranslations("componentText");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on ESC
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={
          unreadCount > 0
            ? t("buttonUnread", { count: unreadCount })
            : t("button")
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border bg-white shadow-xl dark:bg-gray-900 dark:border-gray-700 animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">
              {componentT("notificationsTitle")}
            </span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  title={t("markAllRead")}
                  aria-label={t("markAllRead")}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <CheckCheck size={15} />
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  title={t("clearAllShort")}
                  aria-label={t("clearAll")}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y dark:divide-gray-700">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
                <Bell size={28} className="opacity-30" />
                <p className="text-sm">{componentT("noNotifications")}</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex items-start gap-3 px-4 py-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800",
                    !n.read && "bg-blue-50/60 dark:bg-blue-950/30"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                      TYPE_STYLES[n.type]
                    )}
                  >
                    {TYPE_LABELS[n.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    {n.href ? (
                      <Link
                        href={n.href}
                        onClick={() => { markRead(n.id); setOpen(false); }}
                        className="block text-sm font-medium text-gray-800 dark:text-gray-100 hover:text-blue-600 truncate"
                      >
                        {n.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                        {n.title}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">
                      {n.message}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markRead(n.id)}
                      title={t("markRead")}
                      aria-label={t("markRead")}
                      className="mt-0.5 shrink-0 text-blue-400 hover:text-blue-600 transition-colors"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t px-4 py-2.5 dark:border-gray-700">
            <Link
              href="/notifications/preferences"
              onClick={() => setOpen(false)}
              className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              {componentT("notificationPreferences")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
