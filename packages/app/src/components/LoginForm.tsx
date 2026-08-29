"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { loginSchema, type LoginInput, authApi } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";
import FormField from "@/components/FormField";
import { cn } from "@/lib/utils";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/workers";
  const { login } = useAuth();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, touchedFields, dirtyFields },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
  });

  const isValid = (field: keyof LoginInput) =>
    dirtyFields[field] && !errors[field];

  const onSubmit = async (data: LoginInput) => {
    setApiError(null);
    try {
      const res = await authApi.login(data);
      login(res.data as AuthUser, res.token);
      router.push(redirect);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Login failed");
    }
  };

  const inputClass = (hasError?: boolean, valid?: boolean) =>
    cn(
      "w-full rounded-lg border px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors",
      hasError && "border-red-400 focus:ring-red-300",
      valid && !hasError && "border-green-400 focus:ring-green-300"
    );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
      {apiError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600" role="alert">
          {apiError}
        </div>
      )}

      <FormField
        label="Email"
        id="email"
        error={touchedFields.email ? errors.email?.message : undefined}
        isValid={isValid("email")}
      >
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          {...register("email")}
          className={inputClass(
            touchedFields.email && !!errors.email,
            isValid("email")
          )}
        />
      </FormField>

      <FormField
        label="Password"
        id="password"
        error={touchedFields.password ? errors.password?.message : undefined}
        isValid={isValid("password")}
      >
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          {...register("password")}
          className={inputClass(
            touchedFields.password && !!errors.password,
            isValid("password")
          )}
        />
      </FormField>

      <div className="flex justify-end">
        <Link href="/auth/forgot-password" className="text-xs text-blue-600 hover:underline">
          Forgot password?
        </Link>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {isSubmitting && <Loader2 size={15} className="animate-spin" />}
        Sign in
      </button>
    </form>
  );
}
