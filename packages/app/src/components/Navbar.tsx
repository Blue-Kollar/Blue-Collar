"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, Wallet, ChevronDown, User, Sun, Moon, Globe, X } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useLocale } from "next-intl";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/workers", label: "Workers" },
  { href: "/about", label: "About" },
];

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
  const pathname = usePathname();
  const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "relative text-sm font-medium transition-colors hover:text-blue-600",
        isActive
          ? "text-blue-600 font-semibold"
          : "text-gray-600 dark:text-gray-300"
      )}
    >
      {label}
      {isActive && (
        <span className="absolute -bottom-0.5 left-0 h-0.5 w-full rounded-full bg-blue-600" />
      )}
    </Link>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 min-w-[40px] min-h-[40px] flex items-center justify-center",
        className
      )}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { address, connecting, connect } = useWallet();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Swipe-to-close gesture
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 60) setMobileOpen(false); // swipe right to close
    touchStartX.current = null;
  };

  const shortAddress = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;

  const handleLanguageChange = (newLocale: string) => {
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
    setMobileOpen(false);
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur dark:bg-gray-900/90 dark:border-gray-800">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          {/* Brand */}
          <Link href="/" className="text-xl font-bold text-blue-600">
            BlueCollar
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => <NavLink key={l.href} {...l} />)}
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />

            {/* Language */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200">
                  <Globe size={15} />
                  {locale.toUpperCase()}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[120px] rounded-md border bg-white p-1 shadow-md text-sm dark:bg-gray-900 dark:border-gray-700">
                  {LANGUAGES.map((lang) => (
                    <DropdownMenu.Item key={lang.code} onSelect={() => handleLanguageChange(lang.code)} className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200">
                      {lang.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Wallet */}
            <button onClick={connect} disabled={connecting} className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200">
              <Wallet size={15} />
              {shortAddress ?? (connecting ? "Connecting…" : "Connect Wallet")}
            </button>

            {/* Auth */}
            {user ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200">
                    <User size={15} />
                    {user.firstName}
                    <ChevronDown size={13} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[160px] rounded-md border bg-white p-1 shadow-md text-sm dark:bg-gray-900 dark:border-gray-700">
                    <DropdownMenu.Item onSelect={() => router.push("/profile")} className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200">Profile</DropdownMenu.Item>
                    {(user.role === "curator" || user.role === "admin") && (
                      <DropdownMenu.Item onSelect={() => router.push("/dashboard")} className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200">Dashboard</DropdownMenu.Item>
                    )}
                    {user.role === "admin" && (
                      <DropdownMenu.Item onSelect={() => router.push("/dashboard/admin")} className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200">Admin Analytics</DropdownMenu.Item>
                    )}
                    <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                    <DropdownMenu.Item onSelect={logout} className="cursor-pointer rounded px-3 py-2 text-red-600 hover:bg-red-50 outline-none dark:hover:bg-red-950">Logout</DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <>
                <Link href="/auth/login" className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200">Login</Link>
                <Link href="/auth/register" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Register</Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden flex items-center justify-center rounded-md p-2 min-w-[44px] min-h-[44px] hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          {/* Slide-in panel */}
          <div
            className="fixed right-0 top-0 z-50 h-full w-72 bg-white dark:bg-gray-900 shadow-xl flex flex-col animate-slide-in-right"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-800">
              <span className="text-lg font-bold text-blue-600">BlueCollar</span>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center rounded-md p-2 min-w-[44px] min-h-[44px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              {/* Nav links — large touch targets with active indicator */}
              {NAV_LINKS.map(({ href, label }) => {
                const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors min-h-[48px]",
                      isActive
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    )}
                  >
                    {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />}
                    {label}
                  </Link>
                );
              })}

              <div className="my-2 h-px bg-gray-100 dark:bg-gray-800" />

              {/* Language */}
              <p className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Language</p>
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-left min-h-[48px] w-full transition-colors",
                    locale === lang.code
                      ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  )}
                >
                  {locale === lang.code && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0" />}
                  {lang.label}
                </button>
              ))}

              <div className="my-2 h-px bg-gray-100 dark:bg-gray-800" />

              {/* Wallet */}
              <button
                onClick={() => { connect(); setMobileOpen(false); }}
                disabled={connecting}
                className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium min-h-[48px] hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors"
              >
                <Wallet size={16} />
                {shortAddress ?? (connecting ? "Connecting…" : "Connect Wallet")}
              </button>

              <div className="my-2 h-px bg-gray-100 dark:bg-gray-800" />

              {/* Auth */}
              {user ? (
                <>
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                    <User size={16} className="text-gray-400" />
                    Profile
                  </Link>
                  {(user.role === "curator" || user.role === "admin") && (
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                      Dashboard
                    </Link>
                  )}
                  {user.role === "admin" && (
                    <Link href="/dashboard/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                      Admin Analytics
                    </Link>
                  )}
                  <button onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors w-full text-left">
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="rounded-lg border px-4 py-3 text-center text-sm font-medium min-h-[48px] hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                    Login
                  </Link>
                  <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-medium min-h-[48px] text-white hover:bg-blue-700 transition-colors">
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
