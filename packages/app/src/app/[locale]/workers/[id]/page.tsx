import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Mail, Phone, ArrowLeft } from "lucide-react";
import Link from "next/link";
import TipModal from "@/components/TipModal";
import TransactionHistory from "@/components/TransactionHistory";
import BookmarkButton from "@/components/BookmarkButton";
import StarRating from "@/components/StarRating";
import ReviewCard from "@/components/ReviewCard";
import ReviewForm from "@/components/ReviewForm";
import type { Worker, ApiResponse, Review } from "@/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function fetchWorker(id: string): Promise<Worker | null> {
  const res = await fetch(`${API}/workers/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json: ApiResponse<Worker> = await res.json();
  return json.data;
}

async function fetchReviews(id: string) {
  const res = await fetch(`${API}/workers/${id}/reviews?limit=10`, { cache: "no-store" });
  if (!res.ok) return { data: [], averageRating: null, reviewCount: 0 };
  return res.json() as Promise<{ data: Review[]; averageRating: number | null; reviewCount: number }>;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const worker = await fetchWorker(params.id);
  if (!worker) return { title: "Worker Not Found" };
  return {
    title: worker.name,
    description: worker.bio ?? `View ${worker.name}'s profile on BlueCollar.`,
    openGraph: {
      title: `${worker.name} | BlueCollar`,
      description: worker.bio ?? `View ${worker.name}'s profile on BlueCollar.`,
      images: worker.avatar ? [{ url: worker.avatar }] : [{ url: "/og-image.png" }],
    },
  };
}

export default async function WorkerProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const [data, reviewsData] = await Promise.all([
    fetchWorker(params.id),
    fetchReviews(params.id),
  ]);
  if (!data) notFound();

  const worker = data as Worker;
  const { data: reviews, averageRating, reviewCount } = reviewsData;

  const initials = worker.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/workers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to workers
      </Link>

      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        {/* Avatar + name */}
        <div className="flex items-start gap-5">
          {worker.avatar ? (
            <img
              src={worker.avatar}
              alt={worker.name}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-blue-100"
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

          <BookmarkButton workerId={worker.id} />
        </div>

        {/* Bio */}
        {worker.bio && (
          <p className="mt-6 text-sm leading-relaxed text-gray-600">{worker.bio}</p>
        )}

        {/* Details */}
        <div className="mt-6 flex flex-col gap-2.5">
          {worker.location && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin size={15} className="shrink-0" />
              {worker.location}
            </div>
          )}
          {worker.email && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Mail size={15} className="shrink-0" />
              <a href={`mailto:${worker.email}`} className="hover:text-blue-600 transition-colors">
                {worker.email}
              </a>
            </div>
          )}
          {worker.phone && (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Phone size={15} className="shrink-0" />
              <a href={`tel:${worker.phone}`} className="hover:text-blue-600 transition-colors">
                {worker.phone}
              </a>
            </div>
          )}
        </div>

        {/* Tip section */}
        <div className="mt-8 border-t pt-6">
          {worker.walletAddress ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-700">Support this worker</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Send XLM directly to their Stellar wallet
                  </p>
                </div>
                <TipModal workerName={worker.name} walletAddress={worker.walletAddress} />
              </div>
              <TransactionHistory walletAddress={worker.walletAddress} />
            </>
          ) : (
            <p className="text-sm text-gray-400 italic">
              This worker hasn&apos;t connected a wallet yet.
            </p>
          )}
        </div>

        {/* Reviews section */}
        <div className="mt-8 border-t pt-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Reviews {reviewCount > 0 && `(${reviewCount})`}
          </h2>

          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-3">Leave a review</p>
            <ReviewForm workerId={worker.id} onReviewCreated={() => {}} />
          </div>

          {reviews.length > 0 ? (
            <div>
              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 italic">No reviews yet. Be the first!</p>
          )}
        </div>
      </div>
    </div>
  );
}
