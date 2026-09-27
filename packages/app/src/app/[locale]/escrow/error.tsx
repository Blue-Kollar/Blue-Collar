"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function EscrowError({
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
      title="Couldn't load escrow"
      description="There was a problem loading escrow details. Please try again."
    />
  );
}
