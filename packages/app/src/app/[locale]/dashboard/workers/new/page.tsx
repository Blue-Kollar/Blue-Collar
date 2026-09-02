"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import WorkerForm, { type WorkerFormInput } from "@/components/WorkerForm";
import { useToast } from "@/hooks/useToast";
import { createWorker } from "@/lib/api";

export default function NewWorkerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (data: WorkerFormInput, imageFile: File | null) => {
    setIsSubmitting(true);
    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== "") form.append(k, v as string);
      });
      if (imageFile) form.append("avatar", imageFile);

      await createWorker(form);
      toast("Worker created successfully");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create worker", "error");
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
        <h1 className="mb-6 text-xl font-bold text-gray-900">Create New Worker</h1>
        <WorkerForm
          onSubmit={handleSubmit}
          submitLabel="Create Worker"
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}
