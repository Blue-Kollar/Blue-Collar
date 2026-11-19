"use client";

import { useRouter } from "next/navigation";
import { useWorker } from "@/hooks/queries";
import { EditListingHeader } from "@/components/curator/edit/EditListingHeader";
import { EditListingLoading } from "@/components/curator/edit/EditListingLoading";
import { EditListingError } from "@/components/curator/edit/EditListingError";
import { EditListingForm } from "@/components/curator/edit/EditListingForm";

export default function EditListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { data: workerData, isLoading: loading, error } = useWorker(params.id);
  const worker = workerData?.data ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <EditListingHeader />

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">
          Edit Listing
        </h1>

        {loading && <EditListingLoading />}

        {error && <EditListingError error={error} />}

        {!loading && !error && worker && (
          <EditListingForm
            worker={worker}
            onSuccess={() => router.push("/curator")}
          />
        )}
      </div>
    </div>
  );
}
