import { useCallback,useEffect, useRef } from "react";

const SSE_URL = "/api/workers/events";
const POLL_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;

export function useWorkerEvents(
  onStatusChange: (workerId: string, isActive: boolean) => void
) {
  const esRef = useRef<EventSource | null>(null);
  const backoffRef = useRef(1_000);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/workers?activeOnly=true");
        if (!res.ok) return;
        const workers: Array<{ id: string; isActive: boolean }> =
          await res.json();
        workers.forEach((w) => onStatusChange(w.id, w.isActive));
      } catch {}
    }, POLL_INTERVAL_MS);
  }, [onStatusChange]);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    if (typeof EventSource === "undefined") {
      startPolling();
      return;
    }

    const es = new EventSource(SSE_URL);
    esRef.current = es;

    es.addEventListener("workerStatus", (e: MessageEvent) => {
      try {
        const { workerId, isActive } = JSON.parse(e.data);
        onStatusChange(workerId, isActive);
        backoffRef.current = 1_000;
      } catch {}
    });

    es.addEventListener("error", () => {
      es.close();
      esRef.current = null;
      if (!mountedRef.current) return;

      const delay = Math.min(backoffRef.current, MAX_BACKOFF_MS);
      backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
      setTimeout(connect, delay);
    });
  }, [onStatusChange, startPolling]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      esRef.current?.close();
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [connect]);
}
