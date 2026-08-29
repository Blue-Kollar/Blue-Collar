import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cacheStore } from "./CacheStore";

export interface StaleWhileRevalidateOptions<T> {
  queryKey: string[];
  queryFn: () => Promise<T>;
  cacheKey?: string;
  ttl?: number;
  staleTime?: number;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useStaleWhileRevalidate<T>(options: StaleWhileRevalidateOptions<T>) {
  const { queryKey, queryFn, cacheKey, ttl, staleTime, enabled = true, onSuccess, onError } = options;
  const [isFromCache, setIsFromCache] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);
  const effectiveCacheKey = cacheKey || `cache:query:${queryKey.join(":")}`;

  const getCachedData = useCallback((): T | null => {
    return cacheStore.getCachedData<T>(effectiveCacheKey);
  }, [effectiveCacheKey]);

  const isCacheStale = useCallback((): boolean => {
    return cacheStore.isStale(effectiveCacheKey);
  }, [effectiveCacheKey]);

  const query = useQuery({
    queryKey,
    queryFn,
    enabled,
    staleTime: staleTime || 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  useEffect(() => {
    if (!hasFetchedRef.current && enabled) {
      const cachedData = getCachedData();
      if (cachedData) {
        setIsFromCache(true);
        hasFetchedRef.current = true;
      }
    }
  }, [enabled, getCachedData]);

  useEffect(() => {
    if (query.data && !query.isLoading) {
      cacheStore.setCacheEntry(effectiveCacheKey, query.data, ttl, staleTime);
      onSuccess?.(query.data);
      if (isFromCache && isCacheStale()) {
        setIsRefreshing(true);
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [query.data, query.isLoading, effectiveCacheKey, ttl, staleTime, isFromCache, isCacheStale, onSuccess]);

  useEffect(() => {
    if (query.error) onError?.(query.error as Error);
  }, [query.error, onError]);

  return {
    data: query.data,
    isLoading: query.isLoading && !isFromCache,
    isFromCache,
    isRefreshing,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isStale: isCacheStale(),
  };
}

export function useOfflineQuery<T>(options: StaleWhileRevalidateOptions<T> & { fallbackData?: T }) {
  const { fallbackData, ...rest } = options;
  const result = useStaleWhileRevalidate<T>(rest);

  if (result.isLoading && !result.data && fallbackData) {
    return { ...result, data: fallbackData, isLoading: false };
  }

  if (result.isError && !result.data) {
    const cachedData = cacheStore.getCachedData<T>(`cache:query:${rest.queryKey.join(":")}`);
    if (cachedData) {
      return { ...result, data: cachedData, isError: false, error: undefined, isLoading: false };
    }
  }

  return result;
}

export async function prefetchAndCache<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  cacheKey?: string,
  ttl?: number,
  staleTime?: number
): Promise<T | null> {
  const effectiveCacheKey = cacheKey || `cache:query:${queryKey.join(":")}`;
  try {
    const data = await queryFn();
    cacheStore.setCacheEntry(effectiveCacheKey, data, ttl, staleTime);
    return data;
  } catch (error) {
    console.error("Prefetch failed:", error);
    return cacheStore.getCachedData<T>(effectiveCacheKey);
  }
}