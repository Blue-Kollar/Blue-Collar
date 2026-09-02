/**
 * Thin wrapper around sonner so callers don't import sonner directly.
 * Supports success, error, warning, and info variants.
 * Also provides helpers for API error toasts.
 */
import { toast as sonnerToast } from "sonner";

import { parseApiError } from "@/lib/errors";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useToast() {
  function toast(message: string, type?: ToastType, options?: ToastOptions) {
    if (type === "loading") {
      const id = sonnerToast.loading(message, {
        description: options?.description,
        duration: options?.duration ?? Infinity,
      });
      return {
        id,
        dismiss: () => sonnerToast.dismiss(id),
        update: (newMsg: string, newType?: ToastType) => {
          sonnerToast.dismiss(id);
          sonnerToast[newType ?? "info"](newMsg);
        },
      };
    }
    sonnerToast[type ?? "success"](message, {
      description: options?.description,
      duration: options?.duration,
      action: options?.action,
    });
    return undefined;
  }

  function dismiss(id?: string) {
    sonnerToast.dismiss(id);
  }

  const fromApiError = (error: unknown, fallback?: string) => {
    const parsed = parseApiError(error, fallback);
    sonnerToast[parsed.toastType](parsed.message, {
      description: parsed.code ? `Error: ${parsed.code}` : undefined,
      action: parsed.retryable
        ? {
            label: "Retry",
            onClick: () => window.location.reload(),
          }
        : undefined,
    });
    return parsed;
  };

  return { toast, fromApiError };
}
