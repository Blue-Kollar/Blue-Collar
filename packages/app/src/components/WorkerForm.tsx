"use client";

import { useState, useRef, useEffect, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Upload, X } from "lucide-react";
import FormField from "@/components/FormField";
import { cn } from "@/lib/utils";
import { getCategories } from "@/lib/api";
import type { Category } from "@/types";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const workerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  bio: z.string().max(500, "Bio must be under 500 characters").optional(),
  categoryId: z.string().min(1, "Please select a category"),
  phone: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  walletAddress: z.string().optional(),
});

export type WorkerFormInput = z.infer<typeof workerSchema>;

interface Props {
  defaultValues?: Partial<WorkerFormInput>;
  existingAvatar?: string | null;
  onSubmit: (data: WorkerFormInput, imageFile: File | null) => Promise<void>;
  submitLabel?: string;
  isSubmitting?: boolean;
}

export default function WorkerForm({
  defaultValues,
  existingAvatar,
  onSubmit,
  submitLabel = "Save",
  isSubmitting = false,
}: Props) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(existingAvatar ?? null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkerFormInput>({
    resolver: zodResolver(workerSchema),
    defaultValues,
  });

  useEffect(() => {
    getCategories()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(existingAvatar ?? null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const inputClass = (hasError?: boolean) =>
    cn(
      "w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500",
      hasError && "border-red-400"
    );

  return (
    <form
      onSubmit={handleSubmit((data: WorkerFormInput) => onSubmit(data, imageFile))}
      className="flex flex-col gap-5"
      noValidate
    >
      {/* Profile image */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Profile Image</p>
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 shrink-0">
            {imagePreview ? (
              <>
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-blue-100"
                />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600"
                >
                  <X size={10} />
                </button>
              </>
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                <Upload size={20} />
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
              id="avatar-upload"
            />
            <label
              htmlFor="avatar-upload"
              className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {imagePreview ? "Change image" : "Upload image"}
            </label>
            <p className="mt-1 text-xs text-gray-400">JPG, PNG or WebP. Max 5MB.</p>
          </div>
        </div>
      </div>

      {/* Name */}
      <FormField label="Full name" id="name" error={errors.name?.message}>
        <input
          id="name"
          type="text"
          placeholder="e.g. John Doe"
          {...register("name")}
          className={inputClass(!!errors.name)}
        />
      </FormField>

      {/* Category */}
      <FormField label="Category" id="categoryId" error={errors.categoryId?.message}>
        <select
          id="categoryId"
          {...register("categoryId")}
          className={inputClass(!!errors.categoryId)}
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
      <FormField label="Bio" id="bio" error={errors.bio?.message}>
        <textarea
          id="bio"
          rows={3}
          placeholder="Brief description of skills and experience…"
          {...register("bio")}
          className={cn(inputClass(!!errors.bio), "resize-none")}
        />
      </FormField>

      {/* Phone + Email */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Phone" id="phone" error={errors.phone?.message}>
          <input
            id="phone"
            type="tel"
            placeholder="+1 234 567 8900"
            {...register("phone")}
            className={inputClass(!!errors.phone)}
          />
        </FormField>

        <FormField label="Email" id="email" error={errors.email?.message}>
          <input
            id="email"
            type="email"
            placeholder="worker@example.com"
            {...register("email")}
            className={inputClass(!!errors.email)}
          />
        </FormField>
      </div>

      {/* Wallet address */}
      <FormField label="Stellar Wallet Address" id="walletAddress" error={errors.walletAddress?.message}>
        <input
          id="walletAddress"
          type="text"
          placeholder="G…"
          {...register("walletAddress")}
          className={inputClass(!!errors.walletAddress)}
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
