"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function StatsError({
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
      title="Couldn't load stats"
      description="There was a problem loading platform stats. Please try again."
    />
  );
}
