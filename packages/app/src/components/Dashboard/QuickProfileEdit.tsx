"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check,Loader2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Input } from "@/components/Form/Input";
import type { AuthUser } from "@/types";

const schema = z.object({
  firstName: z.string().min(1, "Required"),
  lastName: z.string().min(1, "Required"),
  email: z.string().email("Invalid email"),
});

type Fields = z.infer<typeof schema>;

interface Props {
  user: AuthUser;
  token: string;
  onSaved?: (updated: Pick<AuthUser, "firstName" | "lastName" | "email">) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export function QuickProfileEdit({ user, token, onSaved }: Props) {
  const [saved, setSaved] = useState(false);
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
    const res = await fetch(`${API}/users/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to save");
    setSaved(true);
    onSaved?.(data);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="First name"
          {...register("firstName")}
          error={errors.firstName?.message}
        />
        <Input
          label="Last name"
          {...register("lastName")}
          error={errors.lastName?.message}
        />
      </div>
      <Input
        label="Email"
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
          {saved ? "Saved!" : "Save changes"}
        </button>
        <a
          href="/settings/profile"
          className="text-sm text-brand-600 hover:underline"
        >
          Full profile settings
        </a>
      </div>
    </form>
  );
}
