"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import FormError from "@/components/FormError";
import FormField from "@/components/FormField";
import PasswordStrength from "@/components/PasswordStrength";
import { authApi,type RegisterInput, registerSchema } from "@/lib/auth";
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

        {/* Google OAuth */}
        <a
          href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"}/auth/google`}
          className="flex w-full items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <GoogleIcon />
          Sign up with Google
        </a>

        <div className="my-1 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {apiError && (
            <FormError message={apiError} />
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

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}
