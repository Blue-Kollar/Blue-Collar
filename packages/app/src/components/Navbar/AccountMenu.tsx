"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, User } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useTranslations } from "next-intl";

/** Account dropdown for signed-in users, or login/register links otherwise. */
export function AccountMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const t = useTranslations("nav");

  if (!user) {
    return (
      <>
        <Link href="/auth/login" className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200">{t("login")}</Link>
        <Link href="/auth/register" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">{t("register")}</Link>
      </>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={t("accountMenu", { name: user.firstName })}
          className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <User size={15} aria-hidden="true" />
          {user.firstName}
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[160px] rounded-md border bg-white p-1 shadow-md text-sm dark:bg-gray-900 dark:border-gray-700">
          <DropdownMenu.Item onSelect={() => router.push("/profile")} className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200">{t("profile")}</DropdownMenu.Item>
          {(user.role === "curator" || user.role === "admin") && (
            <DropdownMenu.Item onSelect={() => router.push("/dashboard")} className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200">{t("dashboard")}</DropdownMenu.Item>
          )}
          {user.role === "admin" && (
            <DropdownMenu.Item onSelect={() => router.push("/dashboard/admin")} className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200">{t("adminAnalytics")}</DropdownMenu.Item>
          )}
          <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
          <DropdownMenu.Item onSelect={logout} className="cursor-pointer rounded px-3 py-2 text-red-600 hover:bg-red-50 outline-none dark:hover:bg-red-950">{t("logout")}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
