"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { registerSchema, type RegisterInput, authApi } from "@/lib/auth";
import FormField from "@/components/FormField";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  const onSubmit = async (data: RegisterInput) => {
    setApiError(null);
    try {
      const { confirmPassword: _confirmPassword, ...payload } = data;
      await authApi.register(payload);
      router.push("/auth/verify-email");
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const inputClass = (hasError?: boolean) =>
    cn(
      "rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500",
      hasError && "border-red-400"
    );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            BlueCollar
          </Link>
          <p className="mt-1 text-sm text-gray-500">Create your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {apiError && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {apiError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="First name" id="firstName" error={errors.firstName?.message}>
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="John"
                {...register("firstName")}
                className={inputClass(!!errors.firstName)}
              />
            </FormField>

            <FormField label="Last name" id="lastName" error={errors.lastName?.message}>
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Doe"
                {...register("lastName")}
                className={inputClass(!!errors.lastName)}
              />
            </FormField>
          </div>

          <FormField label="Email" id="email" error={errors.email?.message}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              {...register("email")}
              className={inputClass(!!errors.email)}
            />
          </FormField>

          <FormField label="Password" id="password" error={errors.password?.message}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              {...register("password")}
              className={inputClass(!!errors.password)}
            />
          </FormField>

          <FormField
            label="Confirm password"
            id="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={inputClass(!!errors.confirmPassword)}
            />
          </FormField>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
          >
            {isSubmitting && <Loader2 size={15} className="animate-spin" />}
            Create account
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
