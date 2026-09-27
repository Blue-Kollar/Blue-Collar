"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function MessagesError({
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
      title="Couldn't load messages"
      description="There was a problem loading your messages. Please try again."
    />
  );
}
