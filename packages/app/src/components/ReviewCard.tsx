import type { Review } from "@/types";
import StarRating from "./StarRating";
import ReviewHelpfulButton from "./ReviewHelpfulButton";
import VerifiedTransactionBadge from "./VerifiedTransactionBadge";

interface ReviewCardProps {
  review: Review;
  showVerifiedBadge?: boolean;
}

export default function ReviewCard({ review, showVerifiedBadge }: ReviewCardProps) {
  const initials = `${review.author.firstName[0]}${review.author.lastName[0]}`.toUpperCase();

  const authorName = `${review.author.firstName} ${review.author.lastName}`;

  return (
    <article
      className="flex gap-3 py-4 border-b last:border-0 dark:border-gray-800"
      aria-label={`Review by ${authorName}`}
    >
      {review.author.avatar ? (
        <img
          src={review.author.avatar}
          alt={authorName}
          className="h-9 w-9 rounded-full object-cover shrink-0"
        />
      ) : (
        // Initials duplicate the author name rendered below — decorative.
        <div
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold dark:bg-blue-900 dark:text-blue-400"
        >
          {initials}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {authorName}
            </span>
            {showVerifiedBadge && <VerifiedTransactionBadge />}
          </div>
          <time dateTime={review.createdAt} className="text-xs text-gray-400 shrink-0">
            {new Date(review.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </time>
        </div>
        <StarRating rating={review.rating} className="mt-0.5" />
        {review.comment && (
          <p className="mt-1.5 text-sm text-gray-600 leading-relaxed dark:text-gray-400">{review.comment}</p>
        )}
        <div className="mt-2">
          <ReviewHelpfulButton reviewId={review.id} />
        </div>
      </div>
    </article>
  );
}
