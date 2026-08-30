"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function DashboardError({
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
      title="Couldn't load dashboard"
      description="There was a problem loading your dashboard. Please try again."
    />
  );
}
