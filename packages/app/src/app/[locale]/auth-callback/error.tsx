"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function AuthCallbackError({
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
      title="Sign-in couldn't complete"
      description="There was a problem finishing the sign-in process. Please try again."
    />
  );
}
