"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import WorkerForm, { type WorkerFormInput } from "@/components/WorkerForm";
import ToastContainer from "@/components/Toast";
import { useToast } from "@/hooks/useToast";
import { getWorker, updateWorker } from "@/lib/api";
import type { Worker } from "@/types";

export default function EditWorkerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    getWorker(params.id)
      .then((res) => setWorker(res.data))
      .catch(() => toast("Failed to load worker", "error"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleSubmit = async (data: WorkerFormInput, imageFile: File | null) => {
    setIsSubmitting(true);
    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== "") form.append(k, v as string);
      });
      if (imageFile) form.append("avatar", imageFile);

      await updateWorker(params.id, form);
      toast("Worker updated successfully");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update worker", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      <div className="rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-gray-900">Edit Worker</h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-blue-500" />
          </div>
        ) : worker ? (
          <WorkerForm
            defaultValues={{
              name: worker.name,
              bio: worker.bio ?? "",
              categoryId: worker.category.id,
              phone: worker.phone ?? "",
              email: worker.email ?? "",
              walletAddress: worker.walletAddress ?? "",
            }}
            existingAvatar={worker.avatar}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            isSubmitting={isSubmitting}
          />
        ) : (
          <p className="text-sm text-gray-500">Worker not found.</p>
        )}
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}
