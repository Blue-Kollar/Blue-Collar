/**
 * Typed React Query hooks for Notifications and Conversations.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import * as api from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";

// ── Notifications ─────────────────────────────────────────────────────────────

export function useNotifications(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => api.getNotifications(params),
    refetchInterval: 30_000, // poll every 30 s
  });
}

export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: () => api.getUnreadNotificationCount(),
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.notifications.list() });
      qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount() });
    },
  });
}

// ── Conversations ─────────────────────────────────────────────────────────────

export function useConversations(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.conversations.list(params),
    queryFn: () => api.getConversations(params),
  });
}

export function useConversation(id: string) {
  return useQuery({
    queryKey: queryKeys.conversations.detail(id),
    queryFn: () => api.getConversation(id),
    enabled: !!id,
  });
}

export function useConversationMessages(id: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.conversations.messages(id, params),
    queryFn: () => api.getConversationMessages(id, params),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

export function useSendMessage(conversationId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.sendMessage>[1]) =>
      api.sendMessage(conversationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.conversations.messages(conversationId) });
    },
  });
}
