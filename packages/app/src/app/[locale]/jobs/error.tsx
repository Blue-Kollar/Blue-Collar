"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function JobsError({
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
      title="Couldn't load jobs"
      description="There was a problem fetching job listings. Please try again."
    />
  );
}
