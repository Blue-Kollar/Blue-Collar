"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import ErrorState from "@/components/ErrorState";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export default function ErrorBoundary({
  error,
  reset,
  title,
  description,
}: Props) {
  const t = useTranslations("errors");
  const [reported, setReported] = useState(false);

  useEffect(() => {
    console.error(error);
  }, [error]);

  const handleReport = () => {
    const report = {
      message: error.message,
      name: error.name,
      stack: error.stack,
      digest: error.digest,
      url: typeof window !== "undefined" ? window.location.href : "",
      timestamp: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2)).catch(() => {});
    setReported(true);
  };

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <ErrorState
        title={title ?? t("genericTitle")}
        message={description ?? t("genericDescription")}
        onRetry={reset}
        retryLabel={t("tryAgain")}
      />
      <div className="mt-5 flex flex-wrap items-center gap-3 justify-center">
        <button
          onClick={handleReport}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          {reported ? "Copied to clipboard" : t("reportError")}
        </button>
      </div>
      {error.digest && (
        <p className="mt-4 text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
      )}
    </div>
  );
}
