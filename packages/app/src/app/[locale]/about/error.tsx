"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function AboutError({
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
      title="Couldn't load this page"
      description="There was a problem loading the about page. Please try again."
    />
  );
}
