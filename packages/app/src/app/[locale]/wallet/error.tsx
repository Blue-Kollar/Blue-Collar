"use client";

import ErrorBoundary from "@/components/ErrorBoundary";

export default function WalletError({
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
      title="Couldn't load wallet"
      description="There was a problem loading your wallet. Please try again."
    />
  );
}
