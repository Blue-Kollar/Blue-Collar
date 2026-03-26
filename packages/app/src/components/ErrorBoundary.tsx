"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
}

export default function ErrorBoundary({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
}: Props) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 mb-4">
        <AlertTriangle size={24} className="text-red-500" />
      </div>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500 max-w-sm">{description}</p>
      <button
        onClick={reset}
        className="mt-5 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
