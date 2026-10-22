"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/Form/Input";
import { Select } from "@/components/Form/Select";
import { FileUpload } from "@/components/Form/FileUpload";
import { useCategories, useCreateWorker, useUpdateWorker } from "@/hooks/queries";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";
// ─── Schema (single source of truth in @bluecollar/types) ────────────────────
import { createWorkerSchema as schema } from "@bluecollar/types";
import type { CreateWorkerInput as Fields } from "@bluecollar/types";
import { useTranslations } from "next-intl";

export interface ListingFormProps {
  /** If provided, the form is in edit mode and uses the X-HTTP-Method: PUT pattern */
  workerId?: string;
  defaultValues?: Partial<Fields>;
  onSuccess?: (workerId: string) => void;
}

export function ListingForm({ workerId, defaultValues, onSuccess }: ListingFormProps) {
  const t = useTranslations("componentText");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: categoriesData } = useCategories();
  const categories: Category[] = categoriesData?.data ?? [];

  const createWorker = useCreateWorker();
  const updateWorker = useUpdateWorker(workerId ?? "");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    // Default categoryId to "" so the disabled placeholder option is selected;
    // otherwise the browser falls back to the first real category and the
    // required-category rule can never fire.
    defaultValues: { categoryId: "", ...defaultValues },
  });

  const onSubmit = async (data: Fields) => {
    setSubmitError(null);
    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== "") form.append(k, v as string);
      });
      if (avatarFile) form.append("avatar", avatarFile);

      let resultId: string;
      if (workerId) {
        const res = await updateWorker.mutateAsync(form);
        if (!res.data) throw new Error(t("saveWorkerFailed"));
        resultId = res.data.id;
      } else {
        const res = await createWorker.mutateAsync(form);
        if (!res.data) throw new Error(t("saveWorkerFailed"));
        resultId = res.data.id;
      }

      onSuccess?.(resultId);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t("genericError"));
    }
  };

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Input
        label={t("formFullName")}
        {...register("name")}
        error={errors.name?.message}
        placeholder={t("nameExample")}
      />

      <Select
        label={t("formCategory")}
        options={categoryOptions}
        placeholder={t("selectCategory")}
        error={errors.categoryId?.message}
        {...register("categoryId")}
      />

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t("formBio")} <span className="font-normal text-gray-400">({t("optional")})</span>
        </label>
        <textarea
          {...register("bio")}
          rows={3}
          placeholder={t("skillsExperiencePlaceholder")}
          className={cn(
            "w-full rounded-lg border px-3 py-2 text-sm",
            "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
            "transition-colors focus:outline-none focus:ring-2",
            "border-gray-300 dark:border-gray-700 focus:border-brand-500 focus:ring-brand-500/20",
            errors.bio && "border-error focus:border-error focus:ring-error/20"
          )}
        />
        {errors.bio && <p className="text-xs text-error">{errors.bio.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t("formPhone")}
          type="tel"
          {...register("phone")}
          error={errors.phone?.message}
          placeholder={t("phoneExample")}
        />
        <Input
          label={t("formEmail")}
          type="email"
          {...register("email")}
          error={errors.email?.message}
          placeholder={t("emailExample")}
        />
      </div>

      <Input
        label={t("stellarWalletAddress")}
        {...register("walletAddress")}
        error={errors.walletAddress?.message}
        placeholder={t("walletExample")}
        hint={t("walletRegistrationHint")}
      />

      <FileUpload
        label={t("profileImage")}
        accept="image/*"
        hint={t("imageUploadHint")}
        onChange={(fl) => setAvatarFile(fl?.[0] ?? null)}
      />

      {submitError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || createWorker.isPending || updateWorker.isPending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
      >
        {(isSubmitting || createWorker.isPending || updateWorker.isPending) && <Loader2 size={15} className="animate-spin" />}
        {workerId ? t("saveChanges") : t("createListing")}
      </button>
    </form>
  );
}
