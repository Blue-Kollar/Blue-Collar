"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/Form/Input";
import { Select } from "@/components/Form/Select";
import { FileUpload } from "@/components/Form/FileUpload";
import { getCategories } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";
// ─── Schema (single source of truth in @bluecollar/types) ────────────────────
import { createWorkerSchema as schema } from "@bluecollar/types";
import type { CreateWorkerInput as Fields } from "@bluecollar/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export interface ListingFormProps {
  /** If provided, the form is in edit mode and uses the X-HTTP-Method: PUT pattern */
  workerId?: string;
  defaultValues?: Partial<Fields>;
  token: string;
  onSuccess?: (workerId: string) => void;
}

export function ListingForm({ workerId, defaultValues, token, onSuccess }: ListingFormProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    getCategories().then((r) => setCategories(r.data)).catch(() => {});
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {},
  });

  const onSubmit = async (data: Fields) => {
    setSubmitError(null);
    try {
      const form = new FormData();
      Object.entries(data).forEach(([k, v]) => {
        if (v !== undefined && v !== "") form.append(k, v as string);
      });
      if (avatarFile) form.append("avatar", avatarFile);

      let res: Response;
      if (workerId) {
        // Update — use X-HTTP-Method: PUT pattern (method-override middleware)
        res = await fetch(`${API}/workers/${workerId}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-HTTP-Method": "PUT",
          },
          body: form,
        });
      } else {
        res = await fetch(`${API}/workers`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: form,
        });
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { message?: string }).message ?? "Request failed");
      }

      const j = await res.json();
      onSuccess?.(workerId ?? j.data.id);
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const categoryOptions = categories.map((c) => ({ label: c.name, value: c.id }));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <Input
        label="Full name"
        {...register("name")}
        error={errors.name?.message}
        placeholder="e.g. João Silva"
      />

      <Select
        label="Category"
        options={categoryOptions}
        placeholder="Select a category"
        error={errors.categoryId?.message}
        {...register("categoryId")}
      />

      {/* Bio */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Bio <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <textarea
          {...register("bio")}
          rows={3}
          placeholder="Brief description of skills and experience..."
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
          label="Phone"
          type="tel"
          {...register("phone")}
          error={errors.phone?.message}
          placeholder="+55 11 99999-9999"
        />
        <Input
          label="Email"
          type="email"
          {...register("email")}
          error={errors.email?.message}
          placeholder="worker@example.com"
        />
      </div>

      <Input
        label="Stellar wallet address"
        {...register("walletAddress")}
        error={errors.walletAddress?.message}
        placeholder="GABC…"
        hint="Required for on-chain registration and tips."
      />

      <FileUpload
        label="Profile image"
        accept="image/*"
        hint="PNG or JPG, up to 5 MB"
        onChange={(fl) => setAvatarFile(fl?.[0] ?? null)}
      />

      {submitError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        {workerId ? "Save changes" : "Create listing"}
      </button>
    </form>
  );
}
