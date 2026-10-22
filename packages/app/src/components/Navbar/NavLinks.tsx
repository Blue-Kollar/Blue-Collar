"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function isPathActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

export function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = isPathActive(pathname, href);
  return (
    <Link
      href={href}
      onClick={onClick}
      // Colour and an underline alone don't convey "current page" to assistive
      // tech — aria-current does.
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "relative rounded text-sm font-medium transition-colors hover:text-blue-600",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
        isActive
          ? "text-blue-600 font-semibold"
          : "text-gray-600 dark:text-gray-300"
      )}
    >
      {label}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-blue-600"
        />
      )}
    </Link>
  );
}

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  return (
    <ul className="hidden list-none items-center gap-6 md:flex">
      {links.map((l) => (
        <li key={l.href}>
          <NavLink {...l} />
        </li>
      ))}
    </ul>
  );
}
