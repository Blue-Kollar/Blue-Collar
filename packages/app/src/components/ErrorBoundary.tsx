"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  routeContext?: string;
}

export default function ErrorBoundary({
  error,
  reset,
  title,
  description,
  routeContext = "unknown",
}: Props) {
  const t = useTranslations("errors");
  const pathname = usePathname();
  const [reported, setReported] = useState(false);

  useEffect(() => {
    const context = {
      routeContext,
      pathname,
      digest: error.digest ?? null,
      occurredAt: new Date().toISOString(),
    };
    console.error("[App Router error]", context, error);
  }, [error, pathname, routeContext]);

  const handleReport = () => {
    const report = {
      routeContext,
      pathname,
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
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mb-4">
        <AlertTriangle size={24} className="text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">
        {title ?? t("genericTitle")}
      </h2>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">
        {description ?? t("genericDescription")}
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3 justify-center">
        <button
          type="button"
          onClick={reset}
          data-testid="route-error-retry"
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          {t("tryAgain")}
        </button>
        <button
          type="button"
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
