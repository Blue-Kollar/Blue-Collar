"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Users, Info, LayoutDashboard, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const BASE_LINKS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/workers", label: "Workers", icon: Users },
  { href: "/about", label: "About", icon: Info },
];

export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();

  const links = [
    ...BASE_LINKS,
    ...(user
      ? [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }]
      : [{ href: "/auth/login", label: "Account", icon: User }]),
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
