"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import WorkerForm, { type WorkerFormInput } from "@/components/WorkerForm";
import PortfolioGallery, { type PortfolioImage } from "@/components/PortfolioGallery";
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
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);

  useEffect(() => {
    getWorker(params.id)
      .then((res) => {
        setWorker(res.data);
        setPortfolioImages(
          (res.data.portfolioImages ?? []).map((img) => ({
            id: img.id,
            url: img.url,
            caption: img.caption ?? undefined,
          }))
        );
      })
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

  const handleAddPortfolioImages = (files: File[]) => {
    const newImages: PortfolioImage[] = files.map((file) => ({
      id: crypto.randomUUID(),
      url: URL.createObjectURL(file),
      caption: "",
    }));
    setPortfolioImages((prev) => [...prev, ...newImages]);
    toast(`${files.length} image${files.length > 1 ? "s" : ""} added`);
  };

  const handleRemovePortfolioImage = (id: string) => {
    setPortfolioImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleReorderPortfolioImages = (images: PortfolioImage[]) => {
    setPortfolioImages(images);
  };

  const handleCaptionChange = (id: string, caption: string) => {
    setPortfolioImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, caption } : img))
    );
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
          <>
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

            {/* Portfolio gallery */}
            <div className="mt-8 border-t pt-6">
              <h2 className="mb-1 text-sm font-semibold text-gray-900">Portfolio Gallery</h2>
              <p className="mb-4 text-xs text-gray-500">
                Showcase your work. Drag to reorder, click a photo to view full size.
              </p>
              <PortfolioGallery
                images={portfolioImages}
                editable
                onAdd={handleAddPortfolioImages}
                onRemove={handleRemovePortfolioImage}
                onReorder={handleReorderPortfolioImages}
                onCaptionChange={handleCaptionChange}
              />
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500">Worker not found.</p>
        )}
      </div>

      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </div>
  );
}