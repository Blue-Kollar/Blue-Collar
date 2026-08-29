"use client";

import { useState, useCallback, ReactNode } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncStateOptions {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Shared async state management hook for loading/error/data patterns.
 * Consolidates the repeated loading/error state pattern used across the app.
 *
 * @example
 * const { data, loading, error, execute } = useAsyncState(fetchUsers)
 * useEffect(() => { execute() }, [execute])
 */
export function useAsyncState<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  options?: UseAsyncStateOptions
) {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState({ data: null, loading: true, error: null });
      try {
        const data = await fn(...args);
        setState({ data, loading: false, error: null });
        options?.onSuccess?.();
        return data;
      } catch (err) {
        const error = err instanceof Error ? err.message : "An error occurred";
        setState({ data: null, loading: false, error });
        options?.onError?.(err instanceof Error ? err : new Error(error));
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fn, options?.onSuccess, options?.onError]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
