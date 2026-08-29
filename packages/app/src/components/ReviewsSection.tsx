"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReviewCard from "./ReviewCard";
import ReviewForm from "./ReviewForm";
import RatingBreakdown from "./RatingBreakdown";
import ReviewSortFilter, { type SortOption } from "./ReviewSortFilter";
import EmptyState from "./EmptyState";
import type { Review, RatingDistributionEntry } from "@/types";
import { getWorkerReviews } from "@/lib/api";
import { queryKeys } from "@/lib/queryClient";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 5;

const SORT_LABELS: Record<SortOption, string> = {
  newest: "newest first",
  oldest: "oldest first",
  highest: "highest rated first",
  lowest: "lowest rated first",
};

interface ReviewsSectionProps {
  workerId: string;
  initialReviews: Review[];
  reviewCount: number;
  averageRating: number | null;
  distribution: RatingDistributionEntry[];
}

export default function ReviewsSection({
  workerId,
  initialReviews,
  reviewCount,
  averageRating,
  distribution,
}: ReviewsSectionProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [count, setCount] = useState<number>(reviewCount);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<SortOption>("newest");
  /** Announced politely when the list changes under the user without a page move. */
  const [announcement, setAnnouncement] = useState("");

  const headingId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  /** Index of the first item revealed by "Load more", so focus can land on it. */
  const focusIndexRef = useRef<number | null>(null);

  const hasReviewed = !!user && reviews.some((r) => r.authorId === user.id);

  const handleReviewCreated = (review: Review) => {
    setReviews((prev) => [review, ...prev]);
    setCount((c) => c + 1);
    setVisibleCount((v) => v + 1);
    setAnnouncement("Your review was posted.");
  };

  const handleSortChange = (next: SortOption) => {
    setSort(next);
    setAnnouncement(`Reviews sorted by ${SORT_LABELS[next]}.`);
  };

  const handleLoadMore = () => {
    // Revealing items below the button leaves keyboard and screen reader users
    // at the bottom of the list with no indication anything appeared, so move
    // focus to the first new review once it renders.
    focusIndexRef.current = visibleCount;
    setVisibleCount((v) => v + PAGE_SIZE);
  };

  useEffect(() => {
    const index = focusIndexRef.current;
    if (index === null) return;
    focusIndexRef.current = null;
    const target = listRef.current?.children[index] as HTMLElement | undefined;
    target?.focus();
  }, [visibleCount]);

  const filterParams = ratingFilter !== null ? { rating: String(ratingFilter), limit: "50" } : undefined;
  const filteredQuery = useQuery({
    queryKey: queryKeys.workers.reviews(workerId, filterParams),
    queryFn: () => getWorkerReviews(workerId, filterParams),
    enabled: ratingFilter !== null,
  });
  const filterLoading = ratingFilter !== null && filteredQuery.isLoading;
  const filteredReviews =
    ratingFilter !== null && filteredQuery.isSuccess ? (filteredQuery.data.data ?? []) : null;

  const handleFilterChange = (rating: number | null) => {
    setRatingFilter(rating);
    setVisibleCount(PAGE_SIZE);
    if (rating === null) {
      setAnnouncement("Rating filter cleared. Showing all reviews.");
    }
  };

  useEffect(() => {
    if (ratingFilter === null) return;
    if (filteredQuery.isSuccess) {
      const n = (filteredQuery.data.data ?? []).length;
      setAnnouncement(`Showing ${n} ${ratingFilter}-star review${n !== 1 ? "s" : ""}.`);
    } else if (filteredQuery.isError) {
      setAnnouncement("Could not load filtered reviews. Showing all reviews.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredQuery.isSuccess, filteredQuery.isError, filteredQuery.data, ratingFilter]);

  const source = filteredReviews ?? reviews;

  const sorted = useMemo(() => {
    const sortedArr = [...source];
    switch (sort) {
      case "newest":
        return sortedArr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "oldest":
        return sortedArr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "highest":
        return sortedArr.sort((a, b) => b.rating - a.rating);
      case "lowest":
        return sortedArr.sort((a, b) => a.rating - b.rating);
      default:
        return sortedArr;
    }
  }, [source, sort]);

  const displayed = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <section
      aria-labelledby={headingId}
      className="mt-8 border-t pt-6 dark:border-gray-800"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 id={headingId} className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Reviews {count > 0 && `(${count})`}
        </h2>
        {count > 0 && <ReviewSortFilter sort={sort} onSortChange={handleSortChange} />}
      </div>

      {/* Sorting, filtering and loading all mutate the list in place; without a
          live region a screen reader user gets no feedback that anything moved. */}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {count > 0 && (
        <RatingBreakdown
          averageRating={averageRating}
          reviewCount={count}
          distribution={distribution}
          onFilterChange={handleFilterChange}
        />
      )}

      <div className="mb-6">
        {hasReviewed ? (
          <p className="text-sm text-gray-500 italic dark:text-gray-400">You have already reviewed this worker.</p>
        ) : (
          // EmptyState's "Write a Review" CTA links here; the id must exist for
          // that skip target to work.
          <div id="review-form">
            <p className="text-sm font-medium text-gray-700 mb-3 dark:text-gray-300">Leave a review</p>
            <ReviewForm workerId={workerId} onReviewCreated={handleReviewCreated} />
          </div>
        )}
      </div>

      {filterLoading ? (
        <div role="status" className="py-6 text-center text-sm text-gray-400">
          Loading reviews…
        </div>
      ) : displayed.length > 0 ? (
        <div>
          <ul ref={listRef} className="list-none p-0 m-0">
            {displayed.map((review) => (
              // tabIndex={-1} makes each item a programmatic focus target for
              // the "Load more" handler without adding it to the tab order.
              <li key={review.id} tabIndex={-1} className="focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                <ReviewCard review={review} />
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              type="button"
              onClick={handleLoadMore}
              aria-label={`Load more reviews, ${sorted.length - visibleCount} remaining`}
              className="mt-4 w-full rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Load more ({sorted.length - visibleCount} remaining)
            </button>
          )}
        </div>
      ) : (
        <EmptyState variant="no-reviews" ctaHref="#review-form" />
      )}
    </section>
  );
}
