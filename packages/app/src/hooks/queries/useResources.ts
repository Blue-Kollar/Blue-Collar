/**
 * Typed React Query hooks for Categories and Auth resources.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { getMe, getMeWithToken } from "@/lib/api/auth";
import { queryKeys } from "@/lib/queryClient";
import type { ApiResponse, Meta, Worker } from "@/types";

// ── Categories ────────────────────────────────────────────────────────────────

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all(),
    queryFn: () => api.getCategories(),
    staleTime: 5 * 60_000, // categories rarely change
  });
}

// ── Auth / current user ────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: () => getMe(),
    retry: 0, // don't retry auth errors
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.updateProfile>[0]) => api.updateProfile(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.auth.me() }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) =>
      api.changePassword(currentPassword, newPassword),
  });
}

/** Updates first/last name and email on the profile settings page (PUT /users/me). */
export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof api.updateAccount>[0]) => api.updateAccount(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.auth.me() }),
  });
}

export function useDeleteAccount() {
  return useMutation({
    mutationFn: () => api.deleteAccount(),
  });
}

/** One-shot fetch of the authenticated user right after an OAuth redirect, before the token is persisted. */
export function useOAuthCallback() {
  return useMutation({
    mutationFn: (token: string) => getMeWithToken(token),
  });
}

// ── Protocol stats (public stats page) ────────────────────────────────────────

export interface ProtocolMetrics {
  timestamp: string;
  totalRegistrations: number;
  activeWorkers: number;
  totalTipVolume: number;
  totalTipCount: number;
  totalEscrowVolume: number;
  activeEscrows: number;
  totalDisputes: number;
  resolvedDisputes: number;
  dataFreshness: string;
}

export function useProtocolMetrics() {
  return useQuery({
    queryKey: ["protocol-metrics"] as const,
    queryFn: async () => {
      const res = await fetch("/api/analytics/metrics");
      const json = await res.json();
      return json.data as ProtocolMetrics;
    },
  });
}

// ── Email notification preferences (settings page) ───────────────────────────

export function useEmailNotificationPrefs() {
  return useQuery({
    queryKey: queryKeys.settings.emailNotificationPrefs(),
    queryFn: () => api.getEmailNotificationPrefs(),
  });
}

export function useUpdateEmailNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: api.EmailNotificationPrefs) => api.updateEmailNotificationPrefs(prefs),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.emailNotificationPrefs() }),
  });
}

// ── Bookmarks ─────────────────────────────────────────────────────────────────

export function useBookmarks(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.bookmarks.list(params),
    queryFn: () => api.getMyBookmarks(params),
  });
}

type BookmarksPage = ApiResponse<Worker[]> & { meta: Meta };
const BOOKMARKS_KEY = ["bookmarks"] as const;

/** Toggles a worker's bookmark, optimistically removing it from cached bookmark lists with rollback on failure. */
export function useToggleBookmark() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (workerId: string) => api.toggleBookmark(workerId),
    onMutate: async (workerId: string) => {
      await qc.cancelQueries({ queryKey: BOOKMARKS_KEY });
      const previous = qc.getQueriesData<BookmarksPage>({ queryKey: BOOKMARKS_KEY });
      qc.setQueriesData<BookmarksPage>({ queryKey: BOOKMARKS_KEY }, (old) =>
        old?.data ? { ...old, data: old.data.filter((w) => w.id !== workerId) } : old
      );
      return { previous };
    },
    onError: (_err, _workerId, context) => {
      context?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: BOOKMARKS_KEY });
    },
  });
}
