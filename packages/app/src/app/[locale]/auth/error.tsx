"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function AuthError({
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
      title="Authentication error"
      description="There was a problem with the authentication flow. Please try again."
    />
  );
}
