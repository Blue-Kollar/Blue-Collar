"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Menu, Wallet, ChevronDown, User, Sun, Moon, Globe } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
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

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium transition-colors hover:text-blue-600",
        pathname === href ? "text-blue-600 font-semibold" : "text-gray-600 dark:text-gray-300"
      )}
    >
      {label}
    </Link>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { address, connecting, connect } = useWallet();
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const shortAddress = address
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : null;

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
    { code: 'es', label: 'Español' }
  ]

  const handleLanguageChange = (newLocale: string) => {
    const newPathname = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPathname)
  }

  const ThemeToggle = ({ className }: { className?: string }) => (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn("rounded-md p-1.5 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800", className)}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur dark:bg-gray-900/90 dark:border-gray-800">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
        {/* Brand */}
        <Link href="/" className="text-xl font-bold text-blue-600">
          BlueCollar
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((l) => (
            <NavLink key={l.href} {...l} />
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />

          {/* Language Switcher */}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200">
                <Globe size={15} />
                {locale.toUpperCase()}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[120px] rounded-md border bg-white p-1 shadow-md text-sm dark:bg-gray-900 dark:border-gray-700"
              >
                {languages.map(lang => (
                  <DropdownMenu.Item
                    key={lang.code}
                    onSelect={() => handleLanguageChange(lang.code)}
                    className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200"
                  >
                    {lang.label}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          {/* Wallet */}
          <button
            onClick={connect}
            disabled={connecting}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200"
          >
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
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 min-w-[160px] rounded-md border bg-white p-1 shadow-md text-sm dark:bg-gray-900 dark:border-gray-700"
                >
                  <DropdownMenu.Item
                    onSelect={() => router.push("/profile")}
                    className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200"
                  >
                    Profile
                  </DropdownMenu.Item>
                  {(user.role === "curator" || user.role === "admin") && (
                    <DropdownMenu.Item
                      onSelect={() => router.push("/dashboard")}
                      className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none dark:hover:bg-gray-800 dark:text-gray-200"
                    >
                      Dashboard
                    </DropdownMenu.Item>
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                  <DropdownMenu.Item
                    onSelect={logout}
                    className="cursor-pointer rounded px-3 py-2 text-red-600 hover:bg-red-50 outline-none dark:hover:bg-red-950"
                  >
                    Logout
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200"
              >
                Login
              </Link>
              <Link
                href="/auth/register"
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                Register
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
          <Dialog.Trigger asChild>
            <button className="md:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800">
              <Menu size={22} />
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
            <Dialog.Content className="fixed right-0 top-0 z-50 h-full w-72 bg-white p-6 shadow-xl flex flex-col gap-6 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <Dialog.Title className="text-lg font-bold text-blue-600">
                  BlueCollar
                </Dialog.Title>
                <ThemeToggle />
              </div>

              {/* Mobile nav links */}
              <div className="flex flex-col gap-4">
                {NAV_LINKS.map((l) => (
                  <NavLink key={l.href} {...l} />
                ))}
              </div>

              <hr className="dark:border-gray-700" />

              {/* Mobile language switcher */}
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Language</p>
                {languages.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      handleLanguageChange(lang.code)
                      setMobileOpen(false)
                    }}
                    className={cn(
                      "rounded px-3 py-2 text-sm text-left",
                      locale === lang.code
                        ? "bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-200"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200"
                    )}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              <hr className="dark:border-gray-700" />

              {/* Mobile wallet */}
              <button
                onClick={connect}
                disabled={connecting}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200"
              >
                <Wallet size={15} />
                {shortAddress ?? (connecting ? "Connecting…" : "Connect Wallet")}
              </button>

              {/* Mobile auth */}
              {user ? (
                <div className="flex flex-col gap-2">
                  <Link href="/profile" className="rounded px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200">
                    Profile
                  </Link>
                  {(user.role === "curator" || user.role === "admin") && (
                    <Link href="/dashboard" className="rounded px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200">
                      Dashboard
                    </Link>
                  )}
                  <button
                    onClick={logout}
                    className="rounded px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/auth/login"
                    className="rounded-md border px-3 py-2 text-center text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    className="rounded-md bg-blue-600 px-3 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Register
                  </Link>
                </div>
              )}
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </nav>
  );
}
