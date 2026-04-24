import Link from "next/link";
import { BadgeCheck, MapPin } from "lucide-react";
import type { Worker } from "@/types";
import BookmarkButton from "./BookmarkButton";
import StarRating from "./StarRating";

export default function WorkerCard({ worker }: { worker: Worker }) {
  const initials = worker.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Link
      href={`/workers/${worker.id}`}
      className="group flex flex-col gap-4 rounded-xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
    >
      {/* Avatar + name */}
      <div className="flex items-center gap-3">
        {worker.avatar ? (
          <img
            src={worker.avatar}
            alt={worker.name}
            className="h-14 w-14 rounded-full object-cover ring-2 ring-blue-100"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-lg">
            {initials}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-semibold text-gray-800 dark:text-gray-100 truncate">
            <span className="truncate">{worker.name}</span>
            {worker.isVerified && (
              <BadgeCheck size={16} className="shrink-0 text-blue-500" aria-label="Verified" />
            )}
          </div>

          {/* Category badge */}
          <span className="mt-0.5 inline-block rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
            {worker.category.name}
          </span>
        </div>

        {/* Bookmark */}
        <BookmarkButton workerId={worker.id} />
      </div>

      {/* Rating */}
      {worker.averageRating != null && (
        <div className="flex items-center gap-1.5">
          <StarRating rating={worker.averageRating} />
          <span className="text-xs text-gray-400">
            {worker.averageRating.toFixed(1)} ({worker.reviewCount})
          </span>
        </div>
      )}

      {/* Bio */}
      {worker.bio && (
        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
          {worker.bio}
        </p>
      )}

      {/* Location */}
      {worker.location && (
        <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
          <MapPin size={12} />
          <span>{worker.location}</span>
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto pt-1">
        <span className="inline-block w-full rounded-md border border-blue-600 py-1.5 text-center text-sm font-medium text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
          View Profile
        </span>
      </div>
    </Link>
  );
}
