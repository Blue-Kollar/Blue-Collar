/**
 * Centralized API client.
 * Automatically attaches the JWT from localStorage, handles 401s by
 * clearing auth state and redirecting to /auth/login.
 */

import type {
  Worker,
  Category,
  ApiResponse,
  Meta,
  Review,
  RatingDistributionEntry,
  WorkerAnalytics,
  CuratorAnalytics,
  PlatformAnalytics,
  ViewTrend,
  TopWorker,
  WorkerPersonalDashboard,
  AppNotification,
  AuditLogEntry,
} from "@/types";
import { BASE, request } from "./api/client";

// ─── Typed endpoint functions ─────────────────────────────────────────────────

// Workers
export const getWorkers = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/workers${qs}`);
};

export const getMyWorkers = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/workers/mine${qs}`);
};

export const getWorker = (id: string) =>
  request<ApiResponse<Worker>>(`/workers/${id}`);

export const createWorker = (data: FormData) =>
  request<ApiResponse<Worker>>("/workers", {
    method: "POST",
    rawBody: data,
  });

export const updateWorker = (id: string, data: FormData) =>
  request<ApiResponse<Worker>>(`/workers/${id}`, {
    method: "POST",
    rawBody: data,
    headers: { "X-HTTP-Method": "PUT" },
  });

export const deleteWorker = (id: string) =>
  request<void>(`/workers/${id}`, { method: "DELETE" });

export const toggleWorker = (id: string) =>
  request<ApiResponse<Worker>>(`/workers/${id}/toggle`, { method: "PATCH" });

// Bookmarks
export const toggleBookmark = (workerId: string) =>
  request<ApiResponse<{ bookmarked: boolean }>>(`/workers/${workerId}/bookmark`, { method: "POST" });

export const getMyBookmarks = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/users/me/bookmarks${qs}`);
};

// Reviews
export const getWorkerReviews = (workerId: string, params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Review[]> & { meta: Meta; averageRating: number | null; reviewCount: number; distribution: RatingDistributionEntry[] }>(
    `/workers/${workerId}/reviews${qs}`
  );
};

export const createReview = (workerId: string, data: { rating: number; comment?: string }) =>
  request<ApiResponse<Review>>(`/workers/${workerId}/reviews`, { method: "POST", body: data });

// Contact requests
export const sendContactRequest = (workerId: string, message: string) =>
  request<ApiResponse<unknown>>(`/workers/${workerId}/contact`, { method: "POST", body: { message } });

// Categories
export const getCategories = () =>
  request<ApiResponse<Category[]>>("/categories");

// User profile
export const updateProfile = (data: { firstName?: string; lastName?: string; phone?: string; bio?: string }) =>
  request<ApiResponse<unknown>>("/users/me", { method: "PATCH", body: data });

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<{ status: string; message: string }>("/users/me/password", {
    method: "PUT",
    body: { currentPassword, newPassword },
  });

export const deleteAccount = () =>
  request<{ status: string; message: string }>("/users/me", { method: "DELETE" });

// Analytics
export const getWorkerAnalytics = (workerId: string) =>
  request<ApiResponse<WorkerAnalytics>>(`/workers/${workerId}/analytics`);

export const getWorkerViewTrends = (workerId: string, days = 30) =>
  request<ApiResponse<ViewTrend[]>>(`/workers/${workerId}/analytics/trends?days=${days}`);

export const getWorkerPersonalDashboard = (workerId: string, params?: { startDate?: string; endDate?: string; days?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<WorkerPersonalDashboard>>(`/workers/${workerId}/analytics/dashboard${qs}`);
};

export const exportWorkerPersonalAnalyticsCsv = (workerId: string, params?: { startDate?: string; endDate?: string; days?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return `${BASE}/workers/${workerId}/analytics/export${qs}`;
};

export const getCuratorAnalytics = () =>
  request<ApiResponse<CuratorAnalytics>>("/analytics/curator");

export const getPlatformAnalytics = () =>
  request<ApiResponse<PlatformAnalytics>>("/analytics/platform");

export const getTopWorkers = (metric = "views", limit = 10) =>
  request<ApiResponse<TopWorker[]>>(`/analytics/top-workers?metric=${metric}&limit=${limit}`);

export const exportCuratorAnalyticsCsv = () =>
  `${BASE}/analytics/export/curator`;

export const exportPlatformAnalyticsCsv = () =>
  `${BASE}/analytics/export/platform`;

// ── Notifications ───────────────────────────────────────────────────────────

export const getNotifications = (params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<AppNotification[]> & { meta: Meta }>(`/v1/notifications${qs}`);
};

export const getUnreadNotificationCount = () =>
  request<{ data: { count: number }; status: string; code: number }>("/v1/notifications/unread-count");

export const markNotificationRead = (id: string) =>
  request<ApiResponse<AppNotification>>(`/v1/notifications/${id}/read`, { method: "PATCH" });

export const markAllNotificationsRead = () =>
  request<{ data: { count: number }; status: string; code: number }>("/v1/notifications/read-all", { method: "PATCH" });

export const deleteNotification = (id: string) =>
  request<void>(`/v1/notifications/${id}`, { method: "DELETE" });

export interface NotificationPreferences {
  newWorkerNearby: boolean;
  statusChange: boolean;
  reviewReply: boolean;
  announcements: boolean;
}

export const getNotificationPreferences = () =>
  request<{ data: NotificationPreferences; status: string }>("/v1/notifications/preferences");

export const updateNotificationPreferences = (prefs: Partial<NotificationPreferences>) =>
  request<{ status: string; message: string }>("/v1/notifications/preferences", {
    method: "PUT",
    body: prefs,
  });

// ── Conversations ───────────────────────────────────────────────────────────

import type { Conversation, Message } from "@/types";

export const getConversations = (params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<Conversation[]> & { meta: Meta }>(`/v1/conversations${qs}`);
};

export const startConversation = (data: { participantId: string; subject?: string; initialMessage: string }) =>
  request<ApiResponse<Conversation>>("/v1/conversations", { method: "POST", body: data });

export const getConversation = (id: string) =>
  request<ApiResponse<Conversation>>(`/v1/conversations/${id}`);

export const getConversationMessages = (id: string, params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<Message[]> & { meta: Meta }>(`/v1/conversations/${id}/messages${qs}`);
};

export const sendMessage = (conversationId: string, data: { body: string; attachmentUrl?: string; attachmentType?: string }) =>
  request<ApiResponse<Message>>(`/v1/conversations/${conversationId}/messages`, { method: "POST", body: data });

export const markConversationRead = (id: string) =>
  request<{ status: string; code: number }>(`/v1/conversations/${id}/read`, { method: "PATCH" });

// ── Review Helpful ──────────────────────────────────────────────────────────

export const toggleReviewHelpful = (reviewId: string) =>
  request<{ data: { helpful: boolean; count: number }; status: string; code: number }>(`/v1/reviews/${reviewId}/helpful`, { method: "POST" });

// ── Admin ──────────────────────────────────────────────────────────────────

export const suspendUser = (userId: string) =>
  request<ApiResponse<{ id: string; suspended: boolean }>>(`/v1/admin/users/${userId}/suspend`, { method: "PATCH" });

export const unsuspendUser = (userId: string) =>
  request<ApiResponse<{ id: string; suspended: boolean }>>(`/v1/admin/users/${userId}/unsuspend`, { method: "PATCH" });

export const banUser = (userId: string) =>
  request<ApiResponse<{ id: string; banned: boolean }>>(`/v1/admin/users/${userId}/ban`, { method: "PATCH" });

export const changeUserRole = (userId: string, role: "user" | "curator" | "admin") =>
  request<ApiResponse<{ id: string; email: string; firstName: string; lastName: string; role: string }>>(
    `/v1/admin/users/${userId}/role`,
    { method: "PATCH", body: { role } },
  );

export const bulkSuspendUsers = (ids: string[]) =>
  request<ApiResponse<{ updated: number; suspended: boolean }>>(`/v1/admin/users/bulk-suspend`, {
    method: "PATCH",
    body: { ids },
  });

export const bulkUnsuspendUsers = (ids: string[]) =>
  request<ApiResponse<{ updated: number; suspended: boolean }>>(`/v1/admin/users/bulk-unsuspend`, {
    method: "PATCH",
    body: { ids },
  });

export const getAuditLogs = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<{ data: AuditLogEntry[]; meta: Meta; status: string; code: number }>(`/v1/audit${qs}`);
};

export interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "user" | "curator" | "admin";
  deletedAt?: string | null;
  verified?: boolean;
  createdAt: string;
}

export const getAdminUsers = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<{ data: AdminUser[]; meta: Meta; status: string; code: number }>(`/v1/admin/users${qs}`);
};

// ── Disputes ────────────────────────────────────────────────────────────────

export interface Dispute {
  id: string;
  workerId: string;
  filedById: string;
  reason: string;
  evidence?: string | null;
  status: string;
  resolution?: string | null;
  resolvedById?: string | null;
  createdAt: string;
  worker: { id: string; name: string };
  filedBy: { id: string; firstName: string; lastName: string };
}

export const getDisputes = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<{ data: Dispute[]; meta: Meta; status: string; code: number }>(`/v1/disputes${qs}`);
};

export const resolveDispute = (id: string, status: string, resolution?: string) =>
  request<ApiResponse<Dispute>>(`/v1/disputes/${id}/resolve`, {
    method: "PATCH",
    body: { status, resolution },
  });

// ── Review moderation ─────────────────────────────────────────────────────────

export interface ModerationReview {
  id: string;
  rating: number;
  comment?: string | null;
  body?: string | null;
  flagged: boolean;
  flagReason?: string | null;
  status: string;
  createdAt: string;
  worker: { id: string; name: string };
  author: { id: string; firstName: string; lastName: string };
}

export const getModerationQueue = () =>
  request<{ data: ModerationReview[]; status: string; code: number }>("/v1/reviews/moderation/queue");

export const moderateReview = (reviewId: string, action: "approve" | "reject") =>
  request<ApiResponse<ModerationReview>>(`/v1/reviews/${reviewId}/moderate`, {
    method: "PATCH",
    body: { action },
  });

// ── Account (profile settings page) ───────────────────────────────────────────

export const updateAccount = (data: { firstName: string; lastName: string; email: string }) =>
  request<ApiResponse<unknown>>("/users/me", { method: "PUT", body: data });

// ── Email notification preferences (settings page) ───────────────────────────

export interface EmailNotificationPrefs {
  newWorkerInArea: boolean;
  workerStatusChange: boolean;
  reviewReplies: boolean;
  platformAnnouncements: boolean;
}

export const getEmailNotificationPrefs = () =>
  request<{ data?: EmailNotificationPrefs; status?: string } | EmailNotificationPrefs>("/users/me/notifications");

export const updateEmailNotificationPrefs = (prefs: EmailNotificationPrefs) =>
  request<{ status: string }>("/users/me/notifications", { method: "PUT", body: prefs });
