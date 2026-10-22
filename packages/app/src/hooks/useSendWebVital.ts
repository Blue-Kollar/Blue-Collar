import { useMutation } from "@tanstack/react-query";

export function useSendWebVital() {
  return useMutation({
    mutationFn: async (metric: unknown) => {
      const body = JSON.stringify(metric);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/vitals", new Blob([body], { type: "application/json" }));
        return true;
      }

      const response = await fetch("/api/vitals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      });
      if (!response.ok) throw new Error("Unable to report web vital");
      return true;
    },
  });
}