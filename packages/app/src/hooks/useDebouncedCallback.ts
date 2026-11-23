import { useCallback, useEffect, useRef, useState } from 'react';

export interface DebouncedCallbackOptions {
  /**
   * Delay in milliseconds before the callback is invoked.
   * Defaults to 300ms.
   */
  delay?: number;
  /**
   * When true, the callback is invoked on the leading edge of the
   * timeout window instead of the trailing edge.
   */
  leading?: boolean;
  /**
   * When true, the callback is invoked on the trailing edge of the
   * timeout window. Defaults to true.
   */
  trailing?: boolean;
}

export interface DebouncedCallback<Args extends unknown[]> {
  (...args: Args): void;
  /**
   * Cancels any pending invocation.
   */
  cancel: () => void;
  /**
   * Immediately invokes the pending callback (if any) and clears the timer.
   */
  flush: () => void;
  /**
   * Returns true when there is a pending invocation.
   */
  isPending: () => boolean;
}

/**
 * Returns a stable, debounced version of the provided callback.
 *
 * The latest callback is always used (via a ref), so consumers do not need
 * to memoize the function they pass in. Timers are cleared on unmount.
 */
export function useDebouncedCallback<Args extends unknown[]>(
  callback: (...args: Args) => void,
  options: DebouncedCallbackOptions = {},
): DebouncedCallback<Args> {
  const { delay = 300, leading = false, trailing = true } = options;

  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingArgsRef = useRef<Args | null>(null);
  const leadingInvokedRef = useRef(false);

  // Keep the latest callback without re-creating the debounced function.
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const invoke = useCallback((args: Args) => {
    callbackRef.current(...args);
  }, []);

  const cancel = useCallback(() => {
    clearTimer();
    pendingArgsRef.current = null;
    leadingInvokedRef.current = false;
  }, [clearTimer]);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimer();
      const args = pendingArgsRef.current;
      pendingArgsRef.current = null;
      if (args && trailing) {
        invoke(args);
      }
    }
    leadingInvokedRef.current = false;
  }, [clearTimer, invoke, trailing]);

  const isPending = useCallback(() => timerRef.current !== null, []);

  const debounced = useCallback(
    (...args: Args) => {
      pendingArgsRef.current = args;

      const isFirstCall = timerRef.current === null;

      if (isFirstCall && leading) {
        leadingInvokedRef.current = true;
        invoke(args);
      }

      clearTimer();

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pendingArgs = pendingArgsRef.current;
        pendingArgsRef.current = null;

        const shouldInvokeTrailing =
          trailing && !(leading && leadingInvokedRef.current && isFirstCall);

        leadingInvokedRef.current = false;

        if (shouldInvokeTrailing && pendingArgs) {
          invoke(pendingArgs);
        }
      }, delay);
    },
    [clearTimer, delay, invoke, leading, trailing],
  ) as DebouncedCallback<Args>;

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.isPending = isPending;

  // Clear any pending timer on unmount.
  useEffect(() => {
    return () => {
      clearTimer();
      pendingArgsRef.current = null;
      leadingInvokedRef.current = false;
    };
  }, [clearTimer]);

  return debounced;
}

/**
 * Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity. Useful for debouncing text inputs.
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebouncedCallback;
