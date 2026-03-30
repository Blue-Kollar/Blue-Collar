"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function WorkersError({
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
      title="Couldn't load workers"
      description="There was a problem fetching the worker listings. Please try again."
    />
  );
}
