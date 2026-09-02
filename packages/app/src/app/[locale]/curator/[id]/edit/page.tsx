"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ListingForm } from "@/components/Curator/ListingForm";
import { useWorker } from "@/hooks/queries";

export default function EditListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: workerData, isLoading: loading, error } = useWorker(params.id);
  const worker = workerData?.data ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/curator"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to console
      </Link>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">
          Edit Listing
        </h1>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">{error instanceof Error ? error.message : "Failed to load listing"}</p>
        )}

        {!loading && !error && worker && (
          <ListingForm
            workerId={worker.id}
            defaultValues={{
              name: worker.name,
              bio: worker.bio ?? "",
              categoryId: worker.category.id,
              phone: worker.phone ?? "",
              email: worker.email ?? "",
              walletAddress: worker.walletAddress ?? "",
            }}
            onSuccess={() => router.push("/curator")}
          />
        )}
      </div>
    </div>
  );
}
