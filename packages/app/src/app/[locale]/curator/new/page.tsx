"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "@/components/Curator/ListingForm";

export default function NewListingPage() {
  const router = useRouter();

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
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">New Listing</h1>
        <ListingForm
          onSuccess={() => router.push("/curator")}
        />
      </div>
    </div>
  );
}
