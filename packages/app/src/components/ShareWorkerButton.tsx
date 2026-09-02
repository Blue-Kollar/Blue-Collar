"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

interface ShareWorkerButtonProps {
  workerName: string;
  category: string;
  profileUrl?: string;
}

export default function ShareWorkerButton({
  workerName,
  category,
  profileUrl,
}: ShareWorkerButtonProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const url = profileUrl ?? (typeof window !== "undefined" ? window.location.href : "");
  const title = `${workerName} - ${category} on Blue Collar`;
  const text = `Check out ${workerName}, a ${category} professional on Blue Collar.`;

  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch (err) {
        if ((err as DOMException).name !== "AbortError") {
          showToast("Could not open share sheet.");
        }
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast("Link copied!");
    } catch {
      showToast("Could not copy link.");
    }
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={handleShare}
        aria-label={`Share ${workerName}'s profile`}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
      >
        <Share2 size={16} aria-hidden="true" />
        Share
      </button>

      {toastVisible && (
        <div
          role="status"
          aria-live="polite"
          className="absolute -top-10 left-1/2 whitespace-nowrap rounded-md bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg -translate-x-1/2"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}
