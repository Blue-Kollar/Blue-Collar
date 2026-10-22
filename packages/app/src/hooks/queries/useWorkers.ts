/**
 * Typed React Query hooks for the Workers resource.
 *
 * Usage:
 *   const { data, isLoading, error } = useWorkers({ category: 'electrician', page: 1 })
 *   const { data: worker } = useWorker(id)
 *   const create = useCreateWorker()
 */
import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import * as api from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import type { Worker, ApiResponse, Meta } from "@/types";

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useWorkers(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.workers.list(params),
    queryFn: () => api.getWorkers(params),
  });
}

/** The curator/admin's own worker listings ("/workers/mine"). */
export function useMyWorkers(params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.workers.mine(params),
    queryFn: () => api.getMyWorkers(params),
  });
}

export function useCuratorAnalytics() {
  return useQuery({
    queryKey: queryKeys.analytics.curator(),
    queryFn: () => api.getCuratorAnalytics(),
  });
}

export function useWorkerViewTrends(workerId: string, days = 30) {
  return useQuery({
    queryKey: queryKeys.workers.trends(workerId, days),
    queryFn: () => api.getWorkerViewTrends(workerId, days),
    enabled: !!workerId,
  });
}

export function useWorkerPersonalDashboard(
  workerId: string,
  params?: { startDate?: string; endDate?: string; days?: number },
) {
  return useQuery({
    queryKey: queryKeys.workers.dashboard(workerId, params),
    queryFn: () => api.getWorkerPersonalDashboard(workerId, params),
    enabled: !!workerId,
  });
}

export function useWorkersInfinite(params?: Omit<Record<string, string>, "cursor">) {
  return useInfiniteQuery({
    queryKey: queryKeys.workers.list({ ...params, infinite: true }),
    queryFn: ({ pageParam }) =>
      api.getWorkers({ ...params, ...(pageParam ? { cursor: pageParam as string } : {}) }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last as any).nextCursor ?? undefined,
  });
}

export function useWorker(id: string) {
  return useQuery({
    queryKey: queryKeys.workers.detail(id),
    queryFn: () => api.getWorker(id),
    enabled: !!id,
  });
}

export function useWorkerAnalytics(id: string) {
  return useQuery({
    queryKey: queryKeys.workers.analytics(id),
    queryFn: () => api.getWorkerAnalytics(id),
    enabled: !!id,
  });
}

export function useWorkerReviews(id: string, params?: Record<string, string>) {
  return useQuery({
    queryKey: queryKeys.workers.reviews(id, params),
    queryFn: () => api.getWorkerReviews(id, params),
    enabled: !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) => api.createWorker(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workers.all() });
    },
  });
}

export function useUpdateWorker(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: FormData) => api.updateWorker(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workers.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.workers.all() });
    },
  });
}

type MyWorkersPage = ApiResponse<Worker[]> & { meta: Meta };
const MINE_KEY = ["workers", "mine"] as const;

/** Deletes a worker, optimistically removing it from the "my workers" list with rollback on failure. */
export function useDeleteWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorker(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: MINE_KEY });
      const previous = qc.getQueriesData<MyWorkersPage>({ queryKey: MINE_KEY });
      qc.setQueriesData<MyWorkersPage>({ queryKey: MINE_KEY }, (old) =>
        old?.data ? { ...old, data: old.data.filter((w) => w.id !== id) } : old
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: MINE_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.workers.all() });
    },
  });
}

/** Toggles a worker's active state, optimistically flipping it in the "my workers" list with rollback on failure. */
export function useToggleWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleWorker(id),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: MINE_KEY });
      const previous = qc.getQueriesData<MyWorkersPage>({ queryKey: MINE_KEY });
      qc.setQueriesData<MyWorkersPage>({ queryKey: MINE_KEY }, (old) =>
        old?.data
          ? { ...old, data: old.data.map((w) => (w.id === id ? { ...w, isActive: !w.isActive } : w)) }
          : old
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      context?.previous?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: (_data, _err, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.workers.detail(id) });
      qc.invalidateQueries({ queryKey: MINE_KEY });
      qc.invalidateQueries({ queryKey: queryKeys.workers.all() });
    },
  });
}

export function useCreateReview(workerId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { rating: number; comment?: string }) =>
      api.createReview(workerId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workers.reviews(workerId) });
    },
  });
}
