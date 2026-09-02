"use client";

import { Clock, Heart,MessageSquare, Star, Wallet } from "lucide-react";

import { cn, formatDate } from "@/lib/utils";

export type ActivityType = "tip" | "review" | "message" | "bookmark" | "escrow";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  createdAt: string;
  href?: string;
}

const iconMap: Record<ActivityType, React.ReactNode> = {
  tip: <Wallet size={14} />,
  review: <Star size={14} />,
  message: <MessageSquare size={14} />,
  bookmark: <Heart size={14} />,
  escrow: <Wallet size={14} />,
};

const colorMap: Record<ActivityType, string> = {
  tip: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
  review: "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400",
  message: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  bookmark: "bg-pink-100 text-pink-600 dark:bg-pink-900/30 dark:text-pink-400",
  escrow: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400",
};

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-gray-400">No activity yet.</div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-gray-200 dark:border-gray-700 pl-6">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={cn(
              "absolute -left-[1.65rem] flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-white dark:ring-gray-900",
              colorMap[item.type]
            )}
            aria-hidden
          >
            {iconMap[item.type]}
          </span>
          <div className="rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {item.href ? (
                <a href={item.href} className="hover:underline">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </p>
            {item.description && (
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
            )}
            <time className="mt-1 flex items-center gap-1 text-xs text-gray-400">
              <Clock size={11} />
              {formatDate(item.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
