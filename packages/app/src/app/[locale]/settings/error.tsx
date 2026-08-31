"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function SettingsError({
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
      title="Couldn't load settings"
      description="There was a problem loading your settings. Please try again."
    />
  );
}
