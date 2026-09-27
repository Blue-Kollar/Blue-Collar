"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  /** Short heading, e.g. "Something went wrong" */
  title?: string;
  /** Detail message — usually the caught error's message */
  message: string;
  /** Called when the user clicks the retry button; omit to hide it */
  onRetry?: () => void;
  retryLabel?: string;
  /** "inline" for a compact banner, "block" for a centered card */
  variant?: "inline" | "block";
  className?: string;
}

export default function ErrorState({
  title,
  message,
  onRetry,
  retryLabel = "Try again",
  variant = "block",
  className,
}: ErrorStateProps) {
  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-wrap items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400",
          className
        )}
      >
        <span>{message}</span>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="underline hover:no-underline"
          >
            {retryLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 py-16 px-6 text-center dark:border-red-900/40 dark:bg-red-900/10",
        className
      )}
    >
      <AlertTriangle size={22} className="text-red-500" aria-hidden="true" />
      {title && (
        <p className="mt-3 text-lg font-semibold text-red-700 dark:text-red-300">{title}</p>
      )}
      <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
