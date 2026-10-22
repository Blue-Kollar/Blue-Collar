"use client";

import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import FormField from "@/components/Form/FormField";
import { FileUpload } from "@/components/Form/FileUpload";
import { cn } from "@/lib/utils";
import { getCategories } from "@/lib/api";
import type { Category } from "@/types";
// ─── Schema (single source of truth in @bluecollar/types) ────────────────────
import { createWorkerSchema as workerSchema } from "@bluecollar/types";
import type { CreateWorkerInput as WorkerFormInput } from "@bluecollar/types";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("componentText");
  return useMemo(() => {
    const steps: CompletionStep[] = [
      { key: "name", label: t("formFullName"), done: (values.name?.length ?? 0) >= 2 },
      { key: "category", label: t("formCategory"), done: !!values.categoryId },
      { key: "bio", label: t("formBio"), done: (values.bio?.length ?? 0) > 0 },
      { key: "avatar", label: t("profilePhoto"), done: hasAvatar },
      { key: "phone", label: t("phoneNumber"), done: !!values.phone },
      { key: "email", label: t("formEmail"), done: !!values.email },
      { key: "wallet", label: t("walletAddress"), done: !!values.walletAddress },
      { key: "portfolio", label: t("portfolioImages"), done: portfolioCount > 0 },
      { key: "availability", label: t("availability"), done: hasAvailability },
    ];
    const done = steps.filter((s) => s.done).length;
    return { steps, percentage: Math.round((done / steps.length) * 100) };
  }, [values, hasAvatar, portfolioCount, hasAvailability, t]);
}

function ProfileCompletionBar({
  steps,
  percentage,
}: {
  steps: CompletionStep[];
  percentage: number;
}) {
  const t = useTranslations("componentText");
  const color =
    percentage === 100 ? "bg-green-500" : percentage >= 60 ? "bg-blue-500" : "bg-amber-500";

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-800">{t("profileCompletion")}</h3>
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
  submitLabel,
  isSubmitting = false,
  onChange,
}: Props) {
  const t = useTranslations("componentText");
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
      .then((res) => setCategories(res.data ?? []))
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
      <FileUpload
        label={t("profileImage")}
        mode="image"
        existingUrl={existingAvatar}
        onChange={(files) => setImageFile(files?.[0] ?? null)}
      />

      {/* Name */}
      <FormField
        label={t("formFullName")}
        id="name"
        error={touchedFields.name ? errors.name?.message : undefined}
        isValid={isValid("name")}
        hint={t("realNameHint")}
      >
        <input
          id="name"
          type="text"
          placeholder={t("nameExample")}
          {...register("name")}
          className={inputClass(touchedFields.name && !!errors.name, isValid("name"))}
        />
      </FormField>

      {/* Category */}
      <FormField
        label={t("formCategory")}
        id="categoryId"
        error={touchedFields.categoryId ? errors.categoryId?.message : undefined}
        isValid={isValid("categoryId")}
        hint={t("tradeHint")}
      >
        <select
          id="categoryId"
          {...register("categoryId")}
          className={inputClass(
            touchedFields.categoryId && !!errors.categoryId,
            isValid("categoryId")
          )}
        >
          <option value="">{t("selectCategory")}</option>
          {categories.map((c: Category) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </FormField>

      {/* Bio */}
      <FormField
        label={t("formBio")}
        id="bio"
        error={touchedFields.bio ? errors.bio?.message : undefined}
        isValid={isValid("bio")}
        hint={t("bioCharacterHint", { count: bioValue.length })}
      >
        <textarea
          id="bio"
          rows={3}
          placeholder={t("skillsExperiencePlaceholder")}
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
          label={t("formPhone")}
          id="phone"
          error={touchedFields.phone ? errors.phone?.message : undefined}
          isValid={isValid("phone")}
          hint={t("phoneCountryCodeHint")}
        >
          <input
            id="phone"
            type="tel"
            placeholder={t("phoneExample")}
            {...register("phone")}
            className={inputClass(touchedFields.phone && !!errors.phone, isValid("phone"))}
          />
        </FormField>

        <FormField
          label={t("formEmail")}
          id="email"
          error={touchedFields.email ? errors.email?.message : undefined}
          isValid={isValid("email")}
        >
          <input
            id="email"
            type="email"
            placeholder={t("emailExample")}
            {...register("email")}
            className={inputClass(touchedFields.email && !!errors.email, isValid("email"))}
          />
        </FormField>
      </div>

      {/* Wallet address */}
      <FormField
        label={t("stellarWalletAddress")}
        id="walletAddress"
        error={touchedFields.walletAddress ? errors.walletAddress?.message : undefined}
        isValid={isValid("walletAddress")}
        hint={t("stellarPublicKeyHint")}
      >
        <input
          id="walletAddress"
          type="text"
          placeholder={t("walletExample")}
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
        {submitLabel ?? t("save")}
      </button>
    </form>
  );
}
