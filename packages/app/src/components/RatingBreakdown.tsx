"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface DistributionEntry {
  rating: number;
  count: number;
  percentage: number;
}

interface Props {
  averageRating: number | null;
  reviewCount: number;
  distribution: DistributionEntry[];
  onFilterChange?: (rating: number | null) => void;
}

export default function RatingBreakdown({ averageRating, reviewCount, distribution, onFilterChange }: Props) {
  const [activeFilter, setActiveFilter] = useState<number | null>(null);

  if (reviewCount === 0) return null;

  const handleFilter = (star: number) => {
    const next = activeFilter === star ? null : star;
    setActiveFilter(next);
    onFilterChange?.(next);
  };

  return (
    <div className="rounded-xl border bg-gray-50 p-4 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="text-center">
          {/* The numeral and the stars say the same thing; expose it once, as one label. */}
          <div
            role="img"
            aria-label={`Average rating ${averageRating?.toFixed(1) ?? 0} out of 5 stars, from ${reviewCount} review${
              reviewCount !== 1 ? "s" : ""
            }`}
          >
            <p className="text-4xl font-bold text-gray-900" aria-hidden="true">
              {averageRating?.toFixed(1)}
            </p>
            <div className="flex items-center justify-center gap-0.5 mt-1" aria-hidden="true">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={14}
                  className={s <= Math.round(averageRating ?? 0) ? "text-yellow-400" : "text-gray-200"}
                  fill={s <= Math.round(averageRating ?? 0) ? "currentColor" : "none"}
                />
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1" aria-hidden="true">
              {reviewCount} review{reviewCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-1.5" role="group" aria-label="Filter reviews by rating">
          {distribution.map(({ rating, count, percentage }) => (
            <button
              key={rating}
              type="button"
              onClick={() => handleFilter(rating)}
              className={`flex items-center gap-2 rounded-md px-2 py-0.5 transition-colors text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                activeFilter === rating ? "bg-blue-50 ring-1 ring-blue-300" : "hover:bg-white"
              }`}
              aria-pressed={activeFilter === rating}
              aria-label={`Filter by ${rating} star${rating !== 1 ? "s" : ""}: ${count} review${
                count !== 1 ? "s" : ""
              }, ${percentage}%`}
            >
              {/* The button's aria-label already carries the numbers, so the bar,
                  the count and the percentage are decorative for screen readers. */}
              <span className="text-xs text-gray-500 w-3 shrink-0" aria-hidden="true">
                {rating}
              </span>
              <Star size={11} className="text-yellow-400 shrink-0" fill="currentColor" aria-hidden="true" />
              <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-yellow-400 transition-all duration-300"
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <span className="text-xs text-gray-400 w-8 text-right shrink-0" aria-hidden="true">
                {percentage}%
              </span>
              <span className="text-xs text-gray-400 w-5 text-right shrink-0" aria-hidden="true">
                ({count})
              </span>
            </button>
          ))}
        </div>
      </div>

      {activeFilter !== null && (
        <div className="flex items-center justify-between border-t pt-3">
          <p className="text-xs text-gray-500">
            Showing {activeFilter}-star reviews
          </p>
          <button
            type="button"
            onClick={() => handleFilter(activeFilter)}
            className="rounded text-xs text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Clear filter
          </button>
        </div>
      )}
    </div>
  );
}
