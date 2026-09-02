import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  max?: number;
  size?: number;
  className?: string;
}

/** Renders filled/empty stars for a numeric rating. */
export default function StarRating({ rating, max = 5, size = 14, className }: StarRatingProps) {
  return (
    <span
      role="img"
      aria-label={`${rating} out of ${max} stars`}
      className={cn("flex items-center gap-0.5", className)}
    >
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          className={i < Math.round(rating) ? "text-yellow-400" : "text-gray-200"}
          fill={i < Math.round(rating) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}
