/**
 * Shared React Query client.
 * Import this singleton wherever you need to imperatively read/write the cache
 * (e.g. invalidateQueries after a mutation).
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,       // 1 min — avoid redundant fetches on re-focus
      retry: 2,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

/** Query key factory — keeps keys consistent and easy to invalidate. */
export const queryKeys = {
  workers: {
    all: () => ["workers"] as const,
    list: (params?: Record<string, unknown>) => ["workers", "list", params] as const,
    mine: (params?: Record<string, unknown>) => ["workers", "mine", params] as const,
    detail: (id: string) => ["workers", "detail", id] as const,
    analytics: (id: string) => ["workers", "analytics", id] as const,
    reviews: (id: string, params?: Record<string, unknown>) => ["workers", "reviews", id, params] as const,
    trends: (id: string, days: number) => ["workers", "trends", id, days] as const,
    dashboard: (id: string, params?: Record<string, unknown>) => ["workers", "dashboard", id, params] as const,
  },
  categories: {
    all: () => ["categories"] as const,
  },
  auth: {
    me: () => ["auth", "me"] as const,
  },
  notifications: {
    list: (params?: Record<string, unknown>) => ["notifications", params] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
  },
  jobs: {
    all: () => ["jobs"] as const,
    list: (params?: Record<string, unknown>) => ["jobs", "list", params] as const,
    detail: (id: string) => ["jobs", "detail", id] as const,
    myPosted: (params?: Record<string, unknown>) => ["jobs", "my-posted", params] as const,
    recommendations: (workerId: string) => ["jobs", "recommendations", workerId] as const,
  },
  conversations: {
    list: (params?: Record<string, unknown>) => ["conversations", params] as const,
    detail: (id: string) => ["conversations", "detail", id] as const,
    messages: (id: string, params?: Record<string, unknown>) => ["conversations", "messages", id, params] as const,
  },
  analytics: {
    curator: () => ["analytics", "curator"] as const,
    platform: () => ["analytics", "platform"] as const,
    topWorkers: (metric: string, limit: number) => ["analytics", "top-workers", metric, limit] as const,
  },
  bookmarks: {
    list: (params?: Record<string, unknown>) => ["bookmarks", params] as const,
  },
  admin: {
    users: (params?: Record<string, unknown>) => ["admin", "users", params] as const,
    disputes: (params?: Record<string, unknown>) => ["admin", "disputes", params] as const,
    moderationQueue: () => ["admin", "moderation-queue"] as const,
    auditLogs: (params?: Record<string, unknown>) => ["admin", "audit", params] as const,
  },
  settings: {
    emailNotificationPrefs: () => ["settings", "email-notification-prefs"] as const,
  },
};
