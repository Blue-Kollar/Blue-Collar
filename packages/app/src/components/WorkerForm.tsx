"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";
import { cn } from "@/lib/utils";
import { getCategories } from "@/lib/api";
import type { Category } from "@/types";
// ─── Schema (single source of truth in @bluecollar/types) ────────────────────
import { createWorkerSchema as workerSchema } from "@bluecollar/types";
import type { CreateWorkerInput as WorkerFormInput } from "@bluecollar/types";

export { workerSchema };
export type { WorkerFormInput };

// ─── Profile completion ──────────────────────────────────────────────────────

interface CompletionStep {
  key: string;
  label: string;
  done: boolean;
}

function useProfileCompletion(
  values: Partial<WorkerFormInput>,
  hasAvatar: boolean,
  portfolioCount: number,
  hasAvailability: boolean,
): { steps: CompletionStep[]; percentage: number } {
  return useMemo(() => {
    const steps: CompletionStep[] = [
      { key: "name", label: "Full name", done: (values.name?.length ?? 0) >= 2 },
      { key: "category", label: "Category", done: !!values.categoryId },
      { key: "bio", label: "Bio", done: (values.bio?.length ?? 0) > 0 },
      { key: "avatar", label: "Profile photo", done: hasAvatar },
      { key: "phone", label: "Phone number", done: !!values.phone },
      { key: "email", label: "Email", done: !!values.email },
      { key: "wallet", label: "Wallet address", done: !!values.walletAddress },
      { key: "portfolio", label: "Portfolio images", done: portfolioCount > 0 },
      { key: "availability", label: "Availability", done: hasAvailability },
    ];
    const done = steps.filter((s) => s.done).length;
    return { steps, percentage: Math.round((done / steps.length) * 100) };
  }, [values, hasAvatar, portfolioCount, hasAvailability]);
}

function ProfileCompletionBar({
  steps,
  percentage,
}: {
  steps: CompletionStep[];
  percentage: number;
}) {
  const color =
    percentage === 100 ? "bg-green-500" : percentage >= 60 ? "bg-blue-500" : "bg-amber-500";

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">Profile Completion</h3>
        <span className={cn("text-sm font-bold", percentage === 100 ? "text-green-600" : "text-gray-700")}>
          {percentage}%
        </span>
      </div>
      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center gap-1.5 text-xs">
            <CheckCircle2
              size={13}
              className={step.done ? "text-green-500" : "text-gray-300"}
            />
            <span className={step.done ? "text-gray-700" : "text-gray-400"}>
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export { useProfileCompletion, ProfileCompletionBar };

interface Props {
  defaultValues?: Partial<WorkerFormInput>;
  existingAvatar?: string | null;
  onSubmit: (data: WorkerFormInput, imageFile: File | null) => Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
  onChange?: (values: WorkerFormInput) => void;
}

export default function WorkerForm({
  defaultValues,
  existingAvatar,
  onSubmit,
  submitLabel = "Save",
  isSubmitting = false,
  onChange,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, touchedFields, dirtyFields },
  } = useForm<WorkerFormInput>({
    resolver: zodResolver(workerSchema),
    defaultValues,
    mode: "onChange",
  });

  const watchedValues = watch();

  useEffect(() => {
    onChange?.(watchedValues);
  }, [watchedValues, onChange]);

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const isValid = (field: keyof WorkerFormInput) =>
    dirtyFields[field] && !errors[field];

  const bioValue = watch("bio") ?? "";

  const inputClass = (hasError?: boolean, valid?: boolean) =>
    cn(
      "w-full rounded-lg border px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors",
      hasError && "border-red-400 focus:ring-red-300",
      valid && !hasError && "border-green-400 focus:ring-green-300"
    );

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data, imageFile))}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* Profile image — issue #271 */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Profile Image</p>
        <ImageUpload
          existingUrl={existingAvatar}
          onChange={(file) => setImageFile(file)}
        />
      </div>

      {/* Name */}
      <FormField
        label="Full name"
        id="name"
        error={touchedFields.name ? errors.name?.message : undefined}
        isValid={isValid("name")}
        hint="Use your real name so clients can find you"
      >
        <input
          id="name"
          type="text"
          placeholder="e.g. John Doe"
          {...register("name")}
          className={inputClass(touchedFields.name && !!errors.name, isValid("name"))}
        />
      </FormField>

      {/* Category */}
      <FormField
        label="Category"
        id="categoryId"
        error={touchedFields.categoryId ? errors.categoryId?.message : undefined}
        isValid={isValid("categoryId")}
        hint="Choose the trade that best describes your work"
      >
        <select
          id="categoryId"
          {...register("categoryId")}
          className={inputClass(
            touchedFields.categoryId && !!errors.categoryId,
            isValid("categoryId")
          )}
        >
          <option value="">Select a category…</option>
          {categories.map((c: Category) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </FormField>

      {/* Bio */}
      <FormField
        label="Bio"
        id="bio"
        error={touchedFields.bio ? errors.bio?.message : undefined}
        isValid={isValid("bio")}
        hint={`${bioValue.length}/500 — describe your skills and experience`}
      >
        <textarea
          id="bio"
          rows={3}
          placeholder="Brief description of skills and experience…"
          {...register("bio")}
          className={cn(
            inputClass(touchedFields.bio && !!errors.bio, isValid("bio")),
            "resize-none"
          )}
        />
      </FormField>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Phone"
          id="phone"
          error={touchedFields.phone ? errors.phone?.message : undefined}
          isValid={isValid("phone")}
          hint="Include country code, e.g. +1 234 567 8900"
        >
          <input
            id="phone"
            type="tel"
            placeholder="+1 234 567 8900"
            {...register("phone")}
            className={inputClass(touchedFields.phone && !!errors.phone, isValid("phone"))}
          />
        </FormField>

        <FormField
          label="Email"
          id="email"
          error={touchedFields.email ? errors.email?.message : undefined}
          isValid={isValid("email")}
        >
          <input
            id="email"
            type="email"
            placeholder="worker@example.com"
            {...register("email")}
            className={inputClass(touchedFields.email && !!errors.email, isValid("email"))}
          />
        </FormField>
      </div>

      {/* Wallet address */}
      <FormField
        label="Stellar Wallet Address"
        id="walletAddress"
        error={touchedFields.walletAddress ? errors.walletAddress?.message : undefined}
        isValid={isValid("walletAddress")}
        hint="Your Stellar public key starts with G and is 56 characters long"
      >
        <input
          id="walletAddress"
          type="text"
          placeholder="G…"
          {...register("walletAddress")}
          className={inputClass(
            touchedFields.walletAddress && !!errors.walletAddress,
            isValid("walletAddress")
          )}
        />
      </FormField>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {submitLabel}
      </button>
    </form>
  );
}
