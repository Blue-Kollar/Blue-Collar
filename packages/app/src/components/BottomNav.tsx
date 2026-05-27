"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Info, LayoutDashboard, User, Settings } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { localizedPath } from "@/lib/i18n";

const BASE_LINKS = [
  { href: "/", labelKey: "home", icon: Home },
  { href: "/workers", labelKey: "workers", icon: Users },
  { href: "/about", labelKey: "about", icon: Info },
];

export default function BottomNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("common");
  const { user } = useAuth();

  const links = [
    ...BASE_LINKS.map((link) => ({
      href: localizedPath(link.href, locale),
      label: t(link.labelKey),
      icon: link.icon,
    })),
    ...(user
      ? [
          { href: localizedPath("/dashboard", locale), label: t("dashboard"), icon: LayoutDashboard },
          { href: localizedPath("/dashboard/settings", locale), label: t("settings"), icon: Settings },
        ]
      : [{ href: localizedPath("/auth/login", locale), label: t("account"), icon: User }]),
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 dark:bg-gray-900/95 dark:border-gray-800 backdrop-blur safe-area-pb">
      <div className="flex items-stretch">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium transition-colors",
                isActive
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 1.75} />
              <span>{label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-blue-600 dark:bg-blue-400" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
