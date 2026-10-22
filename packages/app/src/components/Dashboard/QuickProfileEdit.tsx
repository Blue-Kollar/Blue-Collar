"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Check } from "lucide-react";
import { Input } from "@/components/Form/Input";
import { useQuickProfileUpdate } from "@/hooks/useQuickProfileUpdate";
import type { AuthUser } from "@/types";
import { useTranslations } from "next-intl";

const schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
});

type Fields = z.infer<typeof schema>;

interface Props {
  user: Pick<AuthUser, "firstName" | "lastName" | "email">;
  token: string;
  onSaved?: (updated: Pick<AuthUser, "firstName" | "lastName" | "email">) => void;
}

export function QuickProfileEdit({ user, token, onSaved }: Props) {
  const t = useTranslations("componentText");
  const [saved, setSaved] = useState(false);
  const updateProfile = useQuickProfileUpdate(token);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    },
  });

  const onSubmit = async (data: Fields) => {
    await updateProfile.mutateAsync(data);
    setSaved(true);
    onSaved?.(data);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label={t("firstName")}
          {...register("firstName")}
          error={errors.firstName?.message}
        />
        <Input
          label={t("lastName")}
          {...register("lastName")}
          error={errors.lastName?.message}
        />
      </div>
      <Input
        label={t("formEmail")}
        type="email"
        {...register("email")}
        error={errors.email?.message}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60 transition-colors"
        >
          {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
          {saved ? t("saved") : t("saveChanges")}
        </button>
        <a
          href="/settings/profile"
          className="text-sm text-brand-600 hover:underline"
        >
          {t("fullProfileSettings")}
        </a>
      </div>
    </form>
  );
}
