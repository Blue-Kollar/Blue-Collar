"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function NotificationsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorBoundary
      error={error}
      reset={reset}
      title="Couldn't load notifications"
      description="There was a problem loading your notifications. Please try again."
    />
  );
}
