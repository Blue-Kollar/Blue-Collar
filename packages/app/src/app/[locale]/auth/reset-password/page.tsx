"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { resetPasswordSchema, type ResetPasswordInput, authApi } from "@/lib/auth";
import FormField from "@/components/FormField";
import PasswordStrength from "@/components/PasswordStrength";
import { cn } from "@/lib/utils";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const [apiError, setApiError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting, touchedFields, dirtyFields },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
  });

  const passwordValue = watch("password") ?? "";
  const confirmValue = watch("confirmPassword") ?? "";

  const isValid = (field: keyof ResetPasswordInput) =>
    dirtyFields[field] && !errors[field];

  const onSubmit = async (data: ResetPasswordInput) => {
    if (!token) return;
    setApiError(null);
    try {
      await authApi.resetPassword(token, data.password);
      setSuccess(true);
      setTimeout(() => router.push("/auth/login"), 2500);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  const inputClass = (hasError?: boolean, valid?: boolean) =>
    cn(
      "w-full rounded-lg border px-3 py-2.5 pr-9 text-sm outline-none focus:ring-2 focus:ring-blue-500 transition-colors",
      hasError && "border-red-400 focus:ring-red-300",
      valid && !hasError && "border-green-400 focus:ring-green-300"
    );

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Invalid link</h1>
          <p className="mt-2 text-sm text-gray-500">
            This reset link is missing or invalid. Please request a new one.
          </p>
          <Link
            href="/auth/forgot-password"
            className="mt-5 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm">
        {success ? (
          <div className="text-center py-4">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 size={28} className="text-green-500" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Password updated</h1>
            <p className="mt-2 text-sm text-gray-500">Redirecting you to sign in…</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold text-gray-900">Set new password</h1>
              <p className="mt-1 text-sm text-gray-500">
                Choose a strong password for your account.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
              {apiError && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {apiError}
                </div>
              )}

              <FormField
                label="New password"
                id="password"
                error={touchedFields.password ? errors.password?.message : undefined}
                isValid={isValid("password")}
                hint="At least 8 characters — mix uppercase, numbers and symbols"
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
                className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {isSubmitting && <Loader2 size={15} className="animate-spin" />}
                Update password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
