"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ListingForm } from "@/components/Curator/ListingForm";
import { NewListingHeader } from "@/components/curator/new/NewListingHeader";
import { NewListingShell } from "@/components/curator/new/NewListingShell";

export default function NewListingPage() {
  const router = useRouter();

  return (
    <NewListingShell>
      <Link
        href="/curator"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to console
      </Link>
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <NewListingHeader />
        <ListingForm
          onSuccess={() => router.push("/curator")}
        />
      </div>
    </NewListingShell>
  );
}