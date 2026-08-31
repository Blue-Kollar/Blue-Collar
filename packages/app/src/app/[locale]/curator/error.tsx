"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function CuratorError({
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
      title="Couldn't load curator"
      description="There was a problem loading this curator page. Please try again."
    />
  );
}
