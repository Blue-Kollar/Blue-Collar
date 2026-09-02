"use client";

import { AlertCircle, CheckCircle2, Loader2,MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { authApi } from "@/lib/auth";
import { cn } from "@/lib/utils";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    token ? "loading" : "idle"
  );
  const [message, setMessage] = useState<string | null>(null);

  // Resend state
  const [email, setEmail] = useState("");
  const [resendStatus, setResendStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    authApi
      .verifyAccount(token)
      .then(() => setStatus("success"))
      .catch((err: unknown) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Verification failed");
      });
  }, [token]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendStatus("loading");
    try {
      await authApi.resendVerification(email);
      setResendStatus("sent");
    } catch (err: unknown) {
      setResendError(err instanceof Error ? err.message : "Something went wrong");
      setResendStatus("idle");
    }
  };

  // ── Token present: show verification result ──────────────────────────────
  if (token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
        <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-8 shadow-sm text-center">
          {status === "loading" && (
            <>
              <Loader2 size={36} className="mx-auto mb-4 animate-spin text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verifying…</h1>
              <p className="mt-2 text-sm text-gray-500">Please wait while we verify your email.</p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Email verified!</h1>
              <p className="mt-2 text-sm text-gray-500">Your account is now active. You can sign in.</p>
              <Link
                href="/auth/login"
                className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                Sign in
              </Link>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950">
                <AlertCircle size={28} className="text-red-500" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">Verification failed</h1>
              <p className="mt-2 text-sm text-gray-500">{message ?? "This link is invalid or has expired."}</p>
              <p className="mt-4 text-sm text-gray-500">Enter your email to get a new link:</p>
              <ResendForm
                email={email}
                setEmail={setEmail}
                resendStatus={resendStatus}
                resendError={resendError}
                onSubmit={handleResend}
              />
            </>
          )}
        </div>
      </div>
    );
  }

  // ── No token: "check your email" + resend option ─────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white dark:bg-gray-900 dark:border-gray-800 p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950">
          <MailCheck size={28} className="text-blue-600" />
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Check your email</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          We sent a verification link to your email address. Click the link to activate your account.
        </p>
        <p className="mt-1 text-xs text-gray-400">Didn&apos;t receive it? Check your spam folder or resend below.</p>

        <div className="mt-6 border-t dark:border-gray-800 pt-6">
          {resendStatus === "sent" ? (
            <p className="text-sm text-green-600 dark:text-green-400">
              ✓ A new verification email has been sent.
            </p>
          ) : (
            <ResendForm
              email={email}
              setEmail={setEmail}
              resendStatus={resendStatus}
              resendError={resendError}
              onSubmit={handleResend}
            />
          )}
        </div>

        <Link
          href="/auth/login"
          className="mt-4 inline-block text-sm text-blue-600 hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

function ResendForm({
  email,
  setEmail,
  resendStatus,
  resendError,
  onSubmit,
}: {
  email: string;
  setEmail: (v: string) => void;
  resendStatus: "idle" | "loading" | "sent";
  resendError: string | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  if (resendStatus === "sent") {
    return (
      <p className="text-sm text-green-600 dark:text-green-400">
        ✓ A new verification email has been sent.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 text-left">
      {resendError && (
        <p className="rounded-lg bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-600 dark:text-red-400">
          {resendError}
        </p>
      )}
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className={cn(
          "w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500",
          "dark:bg-gray-800 dark:border-gray-700 dark:text-white dark:placeholder-gray-500"
        )}
      />
      <button
        type="submit"
        disabled={resendStatus === "loading"}
        className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
      >
        {resendStatus === "loading" && <Loader2 size={15} className="animate-spin" />}
        Resend verification email
      </button>
    </form>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
