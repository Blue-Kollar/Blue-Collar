/**
 * Typed React Query hooks for admin resources: users, audit log, disputes, review moderation.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";

// ── Users ──────────────────────────────────────────────────────────────────────

export function useAdminUsers(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.admin.users(params),
    queryFn: () => api.getAdminUsers(params),
  });
}

function useAdminUsersMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useSuspendUser() {
  return useAdminUsersMutation((userId: string) => api.suspendUser(userId));
}

export function useUnsuspendUser() {
  return useAdminUsersMutation((userId: string) => api.unsuspendUser(userId));
}

export function useBanUser() {
  return useAdminUsersMutation((userId: string) => api.banUser(userId));
}

export function useChangeUserRole() {
  return useAdminUsersMutation(({ userId, role }: { userId: string; role: "user" | "curator" | "admin" }) =>
    api.changeUserRole(userId, role)
  );
}

export function useBulkSuspendUsers() {
  return useAdminUsersMutation((ids: string[]) => api.bulkSuspendUsers(ids));
}

export function useBulkUnsuspendUsers() {
  return useAdminUsersMutation((ids: string[]) => api.bulkUnsuspendUsers(ids));
}

// ── Audit log ──────────────────────────────────────────────────────────────────

export function useAuditLogs(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.admin.auditLogs(params),
    queryFn: () => api.getAuditLogs(params),
  });
}

// ── Disputes ───────────────────────────────────────────────────────────────────

export function useDisputes(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.admin.disputes(params),
    queryFn: () => api.getDisputes(params),
  });
}

export function useResolveDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, resolution }: { id: string; status: string; resolution?: string }) =>
      api.resolveDispute(id, status, resolution),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "disputes"] });
    },
  });
}

// ── Review moderation ──────────────────────────────────────────────────────────

export function useModerationQueue() {
  return useQuery({
    queryKey: queryKeys.admin.moderationQueue(),
    queryFn: () => api.getModerationQueue(),
  });
}

/** Approves or rejects a flagged review, optimistically removing it from the queue with rollback on failure. */
export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ reviewId, action }: { reviewId: string; action: "approve" | "reject" }) =>
      api.moderateReview(reviewId, action),
    onMutate: async ({ reviewId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.admin.moderationQueue() });
      const previous = qc.getQueryData<{ data: api.ModerationReview[] }>(queryKeys.admin.moderationQueue());
      qc.setQueryData<{ data: api.ModerationReview[] }>(queryKeys.admin.moderationQueue(), (old) =>
        old ? { ...old, data: old.data.filter((r) => r.id !== reviewId) } : old
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(queryKeys.admin.moderationQueue(), context.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.moderationQueue() });
    },
  });
}
