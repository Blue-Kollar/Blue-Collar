"use client";

import { ThumbsUp } from "lucide-react";
import { useState } from "react";

import { useToggleReviewHelpful } from "@/hooks/queries";
import { cn } from "@/lib/utils";

interface Props {
  reviewId: string;
  initialCount?: number;
  initialHelpful?: boolean;
}

export default function ReviewHelpfulButton({
  reviewId,
  initialCount = 0,
  initialHelpful = false,
}: Props) {
  const [count, setCount] = useState(initialCount);
  const [helpful, setHelpful] = useState(initialHelpful);
  const toggle = useToggleReviewHelpful(reviewId);

  const handleToggle = async () => {
    try {
      const res = await toggle.mutateAsync();
      setHelpful(res.data.helpful);
      setCount(res.data.count);
    } catch {
      // silently fail
    }
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={toggle.isPending}
      aria-busy={toggle.isPending}
      aria-pressed={helpful}
      className={cn(
        "flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        helpful
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
          : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
      )}
      aria-label={`${helpful ? "Remove helpful vote" : "Mark as helpful"} (${count} so far)`}
    >
      <ThumbsUp size={13} fill={helpful ? "currentColor" : "none"} aria-hidden="true" />
      <span aria-hidden="true">{count}</span>
    </button>
  );
}
