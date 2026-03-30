import Link from "next/link";
import { MailCheck } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border bg-white p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <MailCheck size={28} className="text-blue-600" />
        </div>

        <h1 className="text-xl font-bold text-gray-900">Check your email</h1>
        <p className="mt-2 text-sm text-gray-500 leading-relaxed">
          We sent a verification link to your email address. Click the link to
          activate your account.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Didn&apos;t receive it? Check your spam folder.
        </p>

        <Link
          href="/auth/login"
          className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
