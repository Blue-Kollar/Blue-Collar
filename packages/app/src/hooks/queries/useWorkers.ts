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

export function useWorkersInfinite(params?: Omit<Record<string, string>, "cursor">) {
  return useInfiniteQuery({
    queryKey: queryKeys.workers.list({ ...params, infinite: true }),
    queryFn: ({ pageParam }) =>
      api.getWorkers({ ...params, ...(pageParam ? { cursor: pageParam as string } : {}) }),
    initialPageParam: undefined as string | undefined,
    // The API cursor response includes `nextCursor` but the React Query page type
    // is inferred as the generic fetch return; cast is safe given the API contract.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- cursor pagination shape from API
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

export function useDeleteWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteWorker(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.workers.all() });
    },
  });
}

export function useToggleWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.toggleWorker(id),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.workers.detail(id) });
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
