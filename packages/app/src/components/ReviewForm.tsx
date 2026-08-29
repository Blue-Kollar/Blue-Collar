"use client";

import { useId, useRef, useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { createReview } from "@/lib/api";
import type { Review } from "@/types";

interface ReviewFormProps {
  workerId: string;
  onReviewCreated: (review: Review) => void;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Star-picker form for submitting a review.
 * Calls onReviewCreated with the new review on success.
 *
 * The star picker implements the ARIA radiogroup pattern: the group is a single
 * tab stop, and Arrow/Home/End move between stars. Five separately tabbable
 * buttons would otherwise force keyboard users through the whole scale to reach
 * the comment field.
 */
export default function ReviewForm({ workerId, onReviewCreated }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupId = useId();
  const commentId = useId();
  const errorId = useId();
  const starRefs = useRef<(HTMLButtonElement | null)[]>([]);

  /** The star that owns the group's tab stop — the selection, or the first star. */
  const focusableStar = rating || 1;

  const selectStar = (star: number) => {
    setRating(star);
    setError(null);
    starRefs.current[star - 1]?.focus();
  };

  const handleStarKeyDown = (e: React.KeyboardEvent, star: number) => {
    const moves: Record<string, number> = {
      ArrowRight: star + 1,
      ArrowDown: star + 1,
      ArrowLeft: star - 1,
      ArrowUp: star - 1,
      Home: 1,
      End: STARS.length,
    };
    const next = moves[e.key];
    if (next === undefined) return;
    e.preventDefault();
    // Wrap around, matching the radiogroup pattern.
    selectStar(((next - 1 + STARS.length) % STARS.length) + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating.");
      starRefs.current[0]?.focus();
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await createReview(workerId, { rating, comment: comment.trim() || undefined });
      onReviewCreated(res.data);
      setRating(0);
      setComment("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" aria-busy={loading}>
      {/* Star picker */}
      <span id={groupId} className="sr-only">
        Rating
      </span>
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        aria-required="true"
        aria-describedby={error ? errorId : undefined}
        className="flex items-center gap-1"
      >
        {STARS.map((star) => {
          const filled = (hovered || rating) >= star;
          return (
            <button
              key={star}
              ref={(el) => {
                starRefs.current[star - 1] = el;
              }}
              type="button"
              role="radio"
              aria-checked={rating === star}
              tabIndex={star === focusableStar ? 0 : -1}
              onClick={() => selectStar(star)}
              onKeyDown={(e) => handleStarKeyDown(e, star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label={`Rate ${star} star${star > 1 ? "s" : ""}`}
            >
              <Star
                size={22}
                aria-hidden="true"
                className={filled ? "text-yellow-400" : "text-gray-200"}
                fill={filled ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>

      <label htmlFor={commentId} className="sr-only">
        Your review (optional)
      </label>
      <textarea
        id={commentId}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Share your experience (optional)"
        rows={3}
        className="w-full rounded-lg border px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />

      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-500">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {loading && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
        {loading ? "Submitting Review…" : "Submit Review"}
      </button>
    </form>
  );
}
