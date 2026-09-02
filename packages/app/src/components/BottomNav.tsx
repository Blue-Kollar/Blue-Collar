"use client";

import { Compass, Search, User,Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const BOTTOM_NAV_ITEMS = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/workers", label: "Search", icon: Search },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Only show bottom nav on mobile
  if (!user) return null;

  return (
    <nav 
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-white/95 dark:bg-gray-900/95 dark:border-gray-800 backdrop-blur safe-area-pb"
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex items-stretch">
        {BOTTOM_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
