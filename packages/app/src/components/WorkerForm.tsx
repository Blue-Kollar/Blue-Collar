"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import FormField from "@/components/FormField";
import ImageUpload from "@/components/ImageUpload";
import { cn } from "@/lib/utils";
import { getCategories } from "@/lib/api";
import type { Category } from "@/types";

// ─── Schema ───────────────────────────────────────────────────────────────────

export const workerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  bio: z.string().max(500, "Bio must be under 500 characters").optional(),
  categoryId: z.string().min(1, "Please select a category"),
  phone: z
    .string()
    .regex(/^\+?[\d\s\-().]{7,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  walletAddress: z
    .string()
    .regex(/^G[A-Z2-7]{55}$/, "Must be a valid Stellar public key (starts with G)")
    .optional()
    .or(z.literal("")),
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
