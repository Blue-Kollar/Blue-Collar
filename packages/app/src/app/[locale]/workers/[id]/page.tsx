import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { WorkerProfileCard } from '@/components/workers/detail/WorkerProfileCard';
import {
  fetchWorker,
  fetchReviews,
  fetchAvailability,
} from '@/components/workers/detail/workerDetailApi';
import type { Worker } from '@/types';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const worker = await fetchWorker(params.id);
  if (!worker) return { title: 'Worker Not Found' };
  return {
    title: worker.name,
    description: worker.bio ?? `View ${worker.name}'s profile on BlueCollar.`,
    openGraph: {
      title: `${worker.name} | BlueCollar`,
      description: worker.bio ?? `View ${worker.name}'s profile on BlueCollar.`,
      images: worker.avatar ? [{ url: worker.avatar }] : [{ url: '/og-image.png' }],
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
      <Link
        href="/workers"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
      >
        <ArrowLeft size={15} aria-hidden="true" />
        Back to workers
      </Link>

      <WorkerProfileCard
        worker={worker}
        availability={availability}
        reviews={reviews}
        averageRating={averageRating}
        reviewCount={reviewCount}
        distribution={distribution ?? []}
      />
    </div>
  );
}
