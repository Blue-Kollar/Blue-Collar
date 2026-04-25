"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { registerSchema, type RegisterInput, authApi } from "@/lib/auth";
import FormField from "@/components/FormField";
import PasswordStrength from "@/components/PasswordStrength";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, touchedFields, dirtyFields },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
  });

  const passwordValue = watch("password") ?? "";
  const confirmValue = watch("confirmPassword") ?? "";

  const isValid = (field: keyof RegisterInput) =>
    dirtyFields[field] && !errors[field];

  const onSubmit = async (data: RegisterInput) => {
    setApiError(null);
    try {
      const { confirmPassword: _cp, ...payload } = data;
      await authApi.register(payload);
      router.push("/auth/verify-email");
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Registration failed");
    }
  };

  const inputClass = (hasError?: boolean, valid?: boolean) =>
    cn(
      "w-full rounded-lg border px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors",
      hasError && "border-red-400 focus:ring-red-300",
      valid && !hasError && "border-green-400 focus:ring-green-300"
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
            <FormField
              label="First name"
              id="firstName"
              error={touchedFields.firstName ? errors.firstName?.message : undefined}
              isValid={isValid("firstName")}
            >
              <input
                id="firstName"
                type="text"
                autoComplete="given-name"
                placeholder="John"
                {...register("firstName")}
                className={inputClass(
                  touchedFields.firstName && !!errors.firstName,
                  isValid("firstName")
                )}
              />
            </FormField>

            <FormField
              label="Last name"
              id="lastName"
              error={touchedFields.lastName ? errors.lastName?.message : undefined}
              isValid={isValid("lastName")}
            >
              <input
                id="lastName"
                type="text"
                autoComplete="family-name"
                placeholder="Doe"
                {...register("lastName")}
                className={inputClass(
                  touchedFields.lastName && !!errors.lastName,
                  isValid("lastName")
                )}
              />
            </FormField>
          </div>

          <FormField
            label="Email"
            id="email"
            error={touchedFields.email ? errors.email?.message : undefined}
            isValid={isValid("email")}
            hint="We'll send a verification link to this address"
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
            hint="At least 8 characters — mix uppercase, numbers and symbols for a stronger password"
          >
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              {...register("password")}
              className={inputClass(
                touchedFields.password && !!errors.password,
                isValid("password")
              )}
            />
            <PasswordStrength password={passwordValue} />
          </FormField>

          <FormField
            label="Confirm password"
            id="confirmPassword"
            error={touchedFields.confirmPassword ? errors.confirmPassword?.message : undefined}
            isValid={
              !!confirmValue &&
              !errors.confirmPassword &&
              confirmValue === passwordValue
            }
          >
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={inputClass(
                touchedFields.confirmPassword && !!errors.confirmPassword,
                !!confirmValue && !errors.confirmPassword && confirmValue === passwordValue
              )}
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
