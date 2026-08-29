"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";
import { useOAuthCallback } from "@/hooks/queries";

const TOKEN_KEY = "bc_token";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const oauthCallback = useOAuthCallback();

  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setError("Google sign-in failed. Please try again.");
      return;
    }

    const token = searchParams.get("token");
    if (!token) {
      setError("No authentication token received.");
      return;
    }

    oauthCallback.mutate(token, {
      onSuccess: (json) => {
        const user = json.data as AuthUser;
        login(user, token);
        // Redirect to intended page or default
        const redirect = sessionStorage.getItem("oauth_redirect") ?? `/${locale}/workers`;
        sessionStorage.removeItem("oauth_redirect");
        router.replace(redirect);
      },
      onError: () => {
        setError("Sign-in failed. Please try again.");
        localStorage.removeItem(TOKEN_KEY);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, login, router, locale]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-sm rounded-2xl border bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-medium text-red-600">{error}</p>
          <a
            href={`/${locale}/auth/login`}
            className="mt-4 inline-block rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <Loader2 size={32} className="animate-spin text-blue-600" />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
