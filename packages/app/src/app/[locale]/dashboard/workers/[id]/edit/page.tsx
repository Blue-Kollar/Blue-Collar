"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback,useEffect, useState } from "react";

import AvailabilityCalendar, { type Slot } from "@/components/AvailabilityCalendar";
import PerformanceAnalytics from "@/components/PerformanceAnalytics";
import PortfolioGallery, { type PortfolioImage } from "@/components/PortfolioGallery";
import ProfilePreview from "@/components/ProfilePreview";
import VerificationBadges from "@/components/VerificationBadges";
import WorkerForm, {
  ProfileCompletionBar,
  useProfileCompletion,
  type WorkerFormInput,
} from "@/components/WorkerForm";
import { useToast } from "@/hooks/useToast";
import { getCategories,getWorker, updateWorker } from "@/lib/api";
import type { Category,Worker } from "@/types";

export default function EditWorkerPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availability, setAvailability] = useState<Slot[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<"profile" | "portfolio" | "availability">(
    "profile"
  );

  // Real-time preview state
  const [previewValues, setPreviewValues] = useState<Partial<WorkerFormInput>>({});

  useEffect(() => {
    Promise.all([getWorker(params.id), getCategories()])
      .then(([workerRes, catRes]) => {
        const w = workerRes.data;
        setWorker(w);
        setCategories(catRes.data);
        setPortfolioImages(
          (w.portfolioImages ?? []).map((img) => ({
            id: img.id,
            url: img.url,
            caption: img.caption ?? undefined,
          }))
        );
        setPreviewValues({
          name: w.name,
          bio: w.bio ?? "",
          categoryId: w.category.id,
          phone: w.phone ?? "",
          email: w.email ?? "",
          walletAddress: w.walletAddress ?? "",
        });
      })
      .catch(() => toast("Failed to load worker", "error"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleFormChange = useCallback((values: WorkerFormInput) => {
    setPreviewValues(values);
  }, []);

  const handleSubmit = async (data: WorkerFormInput, imgFile: File | null) => {
    setIsSubmitting(true);
    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== "") form.append(k, v as string);
      });
      if (imgFile) form.append("avatar", imgFile);

      await updateWorker(params.id, form);
      toast("Worker updated successfully");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update worker", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Portfolio handlers
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

  // Availability handlers
  const handleAddSlot = useCallback((slot: Slot) => {
    setAvailability((prev) => {
      const filtered = prev.filter((s) => s.dayOfWeek !== slot.dayOfWeek);
      return [...filtered, slot].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
  }, []);

  const handleRemoveSlot = useCallback((dayOfWeek: number) => {
    setAvailability((prev) => prev.filter((s) => s.dayOfWeek !== dayOfWeek));
  }, []);

  const handleBulkSet = useCallback((slots: Slot[]) => {
    setAvailability((prev) => {
      const daySet = new Set(slots.map((s) => s.dayOfWeek));
      const kept = prev.filter((s) => !daySet.has(s.dayOfWeek));
      return [...kept, ...slots].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
    toast(`Availability set for ${slots.length} day${slots.length > 1 ? "s" : ""}`);
  }, [toast]);

  // Profile completion
  const hasAvatar = !!worker?.avatar;
  const categoryName = categories.find((c) => c.id === previewValues.categoryId)?.name;
  const { steps, percentage } = useProfileCompletion(
    previewValues,
    hasAvatar,
    portfolioImages.length,
    availability.length > 0
  );

  const tabs = [
    { key: "profile" as const, label: "Profile" },
    { key: "portfolio" as const, label: `Portfolio (${portfolioImages.length})` },
    { key: "availability" as const, label: "Availability" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-blue-500" />
        </div>
      ) : worker ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main content — left 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Header */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h1 className="text-xl font-bold text-gray-900">Edit Worker</h1>
                <VerificationBadges
                  isVerified={worker.isVerified}
                  hasPhone={!!previewValues.phone}
                  hasEmail={!!previewValues.email}
                  hasWallet={!!previewValues.walletAddress}
                  hasAvatar={hasAvatar}
                  compact
                />
              </div>

              {/* Profile Completion */}
              <ProfileCompletionBar steps={steps} percentage={percentage} />
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 rounded-xl border bg-gray-50 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === tab.key
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              {activeTab === "profile" && (
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
                  onChange={handleFormChange}
                />
              )}

              {activeTab === "portfolio" && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-gray-900">
                    Portfolio Gallery
                  </h2>
                  <p className="mb-4 text-xs text-gray-500">
                    Showcase your work. Drag to reorder, click a photo to view full
                    size. You can also drag and drop files directly.
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
              )}

              {activeTab === "availability" && (
                <div>
                  <h2 className="mb-1 text-sm font-semibold text-gray-900">
                    Availability Schedule
                  </h2>
                  <p className="mb-4 text-xs text-gray-500">
                    Set your weekly availability so clients know when to reach you.
                    Use bulk set to quickly configure multiple days at once.
                  </p>
                  <AvailabilityCalendar
                    availability={availability}
                    editable
                    onAdd={handleAddSlot}
                    onRemove={handleRemoveSlot}
                    onBulkSet={handleBulkSet}
                  />
                </div>
              )}
            </div>

            {/* Performance analytics */}
            <PerformanceAnalytics
              averageRating={worker.averageRating ?? null}
              reviewCount={worker.reviewCount ?? 0}
            />
          </div>

          {/* Sidebar — right col */}
          <div className="space-y-6">
            {/* Live Preview */}
            <div className="lg:sticky lg:top-6">
              <ProfilePreview
                name={previewValues.name ?? worker.name}
                bio={previewValues.bio ?? worker.bio ?? undefined}
                categoryName={categoryName ?? worker.category.name}
                phone={previewValues.phone}
                email={previewValues.email}
                walletAddress={previewValues.walletAddress}
                avatarUrl={worker.avatar}
                isVerified={worker.isVerified}
                averageRating={worker.averageRating}
                reviewCount={worker.reviewCount}
                portfolioImages={portfolioImages}
              />

              {/* Verification badges (full view) */}
              <div className="mt-6">
                <VerificationBadges
                  isVerified={worker.isVerified}
                  hasPhone={!!previewValues.phone}
                  hasEmail={!!previewValues.email}
                  hasWallet={!!previewValues.walletAddress}
                  hasAvatar={hasAvatar}
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm text-gray-500">Worker not found.</p>
        </div>
      )}
    </div>
  );
}
