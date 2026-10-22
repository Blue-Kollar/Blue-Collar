"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Search, Wallet, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const BOTTOM_NAV_ITEMS = [
  { href: "/", key: "discover", icon: Compass },
  { href: "/workers", key: "search", icon: Search },
  { href: "/wallet", key: "wallet", icon: Wallet },
  { href: "/profile", key: "profile", icon: User },
];

export default function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { user } = useAuth();

  // Only show bottom nav on mobile
  if (!user) return null;

  return (
    <nav 
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 dark:bg-gray-900/95 dark:border-gray-800 backdrop-blur safe-area-pb"
      role="navigation"
      aria-label={t("mobileNavigation")}
    >
      <div className="flex items-stretch">
        {BOTTOM_NAV_ITEMS.map(({ href, key, icon: Icon }) => {
          const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[56px] text-xs font-medium transition-all duration-200",
                isActive
                  ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon 
                size={24} 
                strokeWidth={isActive ? 2.5 : 1.75}
                fill={isActive ? "currentColor" : "none"}
              />
              <span className="text-[10px]">{t(key)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
