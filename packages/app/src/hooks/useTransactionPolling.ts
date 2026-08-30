/**
 * useTransactionPolling
 *
 * Fires a callback on a fixed interval while the component is mounted,
 * and pauses automatically when the document is hidden (page in background).
 *
 * Useful for refreshing Horizon payment lists without wiring up the
 * fetching and filtering concerns inside the same hook.
 */
import { useCallback, useEffect, useRef } from "react";

export interface UseTransactionPollingOptions {
  /** Interval between polls in milliseconds. Defaults to 30 000 (30 s). */
  intervalMs?: number;
  /** Set to false to pause polling without unmounting. Defaults to true. */
  enabled?: boolean;
}

/**
 * Calls `onPoll` on a regular interval.
 *
 * - Polling is suspended while the browser tab is hidden (visibilitychange).
 * - `onPoll` is wrapped in a stable ref so callers can pass an inline lambda
 *   without causing the interval to restart on every render.
 */
export function useTransactionPolling(
  onPoll: () => void,
  { intervalMs = 30_000, enabled = true }: UseTransactionPollingOptions = {},
): void {
  // Keep the latest callback in a ref to avoid restarting the interval when
  // the caller's closure changes.
  const callbackRef = useRef(onPoll);
  useEffect(() => {
    callbackRef.current = onPoll;
  }, [onPoll]);

  const stableCallback = useCallback(() => {
    callbackRef.current();
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (document.visibilityState !== "hidden") {
        stableCallback();
      }
    };

    const id = setInterval(tick, intervalMs);

    const handleVisibility = () => {
      // Resume immediately when the tab becomes visible again.
      if (document.visibilityState === "visible") {
        stableCallback();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs, stableCallback]);
}
