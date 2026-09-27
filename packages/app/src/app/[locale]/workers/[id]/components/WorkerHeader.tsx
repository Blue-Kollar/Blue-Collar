import { BadgeCheck } from "lucide-react";
import dynamic from "next/dynamic";
import StarRating from "@/components/StarRating";
import BookmarkButton from "@/components/BookmarkButton";
import ZoomableAvatar from "@/components/ZoomableAvatar";
import ShareWorkerButton from "@/components/ShareWorkerButton";
import type { Worker } from "@/types";

// Interaction-gated widgets — split out so they aren't bundled into the initial route chunk.
const QRCodeButton = dynamic(() => import("@/components/QRCodeButton"));
const ContactModal = dynamic(() => import("@/components/ContactModal"));

interface Props {
  worker: Worker;
  averageRating: number | null;
  reviewCount: number;
}

export function WorkerHeader({ worker, averageRating, reviewCount }: Props) {
  const initials = worker.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-start gap-5">
      {worker.avatar ? (
        <ZoomableAvatar
          src={worker.avatar}
          alt={worker.name}
          priority
          className="h-20 w-20 rounded-full object-cover ring-2 ring-blue-100 cursor-zoom-in"
        />
      ) : (
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-bold text-2xl">
          {initials}
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-xl font-bold text-gray-900">
          {worker.name}
          {worker.isVerified && (
            <BadgeCheck size={20} className="text-blue-500" aria-label="Verified" />
          )}
          <QRCodeButton workerName={worker.name} workerId={worker.id} />
        </div>
        <span className="mt-1 inline-block rounded-full bg-blue-50 px-3 py-0.5 text-sm font-medium text-blue-600">
          {worker.category.name}
        </span>
        {averageRating != null && (
          <div className="mt-2 flex items-center gap-1.5">
            <StarRating rating={averageRating} />
            <span className="text-sm text-gray-500">
              {averageRating.toFixed(1)} ({reviewCount} review{reviewCount !== 1 ? "s" : ""})
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ShareWorkerButton workerName={worker.name} category={worker.category.name} />
        <BookmarkButton workerId={worker.id} />
        <ContactModal workerId={worker.id} workerName={worker.name} />
      </div>
    </div>
  );
}
