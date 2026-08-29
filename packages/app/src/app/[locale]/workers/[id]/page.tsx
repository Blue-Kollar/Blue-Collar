import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import ReviewsSection from "@/components/ReviewsSection";
import AvailabilityCalendar from "@/components/AvailabilityCalendar";
import VerificationBadges from "@/components/VerificationBadges";
import RatingBreakdown from "@/components/RatingBreakdown";
import OnChainBadge from "@/components/WorkerProfile/OnChainBadge";
import { WorkerHeader } from "./components/WorkerHeader";
import { WorkerContactDetails } from "./components/WorkerContactDetails";
import { WorkerTipSection } from "./components/WorkerTipSection";
import type { Worker, ApiResponse, Review, RatingDistributionEntry } from "@/types";

// Below-the-fold widget — split out so it isn't bundled into the initial route chunk.
const PortfolioGallery = dynamic(() => import("@/components/PortfolioGallery"));

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function fetchWorker(id: string): Promise<Worker | null> {
  const res = await fetch(`${API}/workers/${id}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json: ApiResponse<Worker> = await res.json();
  return json.data ?? null;
}

async function fetchReviews(id: string) {
  const res = await fetch(`${API}/workers/${id}/reviews?limit=10`, { cache: "no-store" });
  if (!res.ok) return { data: [], averageRating: null, reviewCount: 0, distribution: [] };
  return res.json() as Promise<{ data: Review[]; averageRating: number | null; reviewCount: number; distribution: RatingDistributionEntry[] }>;
}

async function fetchAvailability(id: string) {
  const res = await fetch(`${API}/workers/${id}/availability`, { cache: "no-store" });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.data ?? []) as { dayOfWeek: number; startTime: string; endTime: string }[];
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
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

export default async function WorkerProfilePage({ params }: { params: { id: string } }) {
  const [data, reviewsData, availability] = await Promise.all([
    fetchWorker(params.id),
    fetchReviews(params.id),
    fetchAvailability(params.id),
  ]);
  if (!data) notFound();

  const worker = data as Worker;
  const { data: reviews, averageRating, reviewCount, distribution } = reviewsData;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/workers" className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
        <ArrowLeft size={15} aria-hidden="true" />
        Back to workers
      </Link>

      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <WorkerHeader worker={worker} averageRating={averageRating} reviewCount={reviewCount} />
          </div>
          <OnChainBadge
            contractId={process.env.NEXT_PUBLIC_REGISTRY_CONTRACT_ID}
            workerId={worker.id}
          />
        </div>

        <VerificationBadges
          isVerified={worker.isVerified}
          hasPhone={!!worker.phone}
          hasEmail={!!worker.email}
          hasWallet={!!worker.walletAddress}
          hasAvatar={!!worker.avatar}
        />

        {worker.bio && (
          <p className="mt-6 text-sm leading-relaxed text-gray-600">{worker.bio}</p>
        )}

        <WorkerContactDetails worker={worker} />

        <div className="mt-8 border-t pt-6">
          <AvailabilityCalendar availability={availability} />
        </div>

        {worker.portfolioImages && worker.portfolioImages.length > 0 && (
          <div className="mt-8 border-t pt-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Portfolio</h2>
            <PortfolioGallery images={worker.portfolioImages.map((img) => ({ id: img.id, url: img.url, caption: img.caption ?? undefined }))} />
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <WorkerTipSection workerName={worker.name} walletAddress={worker.walletAddress} />
        </div>

        <RatingBreakdown
          averageRating={averageRating}
          reviewCount={reviewCount}
          distribution={distribution ?? []}
        />

        <ReviewsSection
          workerId={worker.id}
          initialReviews={reviews}
          reviewCount={reviewCount}
          averageRating={averageRating}
          distribution={distribution ?? []}
        />
      </div>
    </div>
  );
}
