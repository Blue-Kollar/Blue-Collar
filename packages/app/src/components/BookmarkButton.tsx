"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToggleBookmark } from "@/hooks/queries";
import { cn } from "@/lib/utils";

interface BookmarkButtonProps {
  workerId: string;
  initialBookmarked?: boolean;
  className?: string;
}

/**
 * Heart icon button that toggles a worker bookmark for the authenticated user.
 * Optimistically updates UI on click via the shared useToggleBookmark hook.
 */
export default function BookmarkButton({
  workerId,
  initialBookmarked = false,
  className,
}: BookmarkButtonProps) {
  const t = useTranslations("workerCard");
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const toggleBookmark = useToggleBookmark();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (toggleBookmark.isPending) return;
    // Optimistic update
    setBookmarked((prev) => !prev);
    try {
      const res = await toggleBookmark.mutateAsync(workerId);
      setBookmarked(res.data.bookmarked);
    } catch {
      setBookmarked((prev) => !prev); // revert on error
    }
  };

  return (
    <button
      onClick={handleClick}
      aria-label={bookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}
      className={cn(
        "rounded-full p-1.5 transition-colors",
        bookmarked
          ? "text-red-500 hover:text-red-600"
          : "text-gray-300 hover:text-red-400",
        className
      )}
    >
      <Heart size={18} fill={bookmarked ? "currentColor" : "none"} />
    </button>
  );
}
