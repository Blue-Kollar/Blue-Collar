"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function WorkerProfileError({
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
      title="Couldn't load this profile"
      description="There was a problem fetching this worker's profile. Please try again."
    />
  );
}
