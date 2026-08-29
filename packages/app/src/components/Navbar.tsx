"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, Wallet, ChevronDown, User, Sun, Moon, Globe, X, MessageSquare } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { useLocale, useTranslations } from "next-intl";
import { cn, formatStellarAddress } from "@/lib/utils";
import NotificationDropdown from "@/components/NotificationDropdown";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

/** Selectors for everything focusable inside the mobile drawer. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

function isPathActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}

function NavLink({ href, label, onClick }: { href: string; label: string; onClick?: () => void }) {
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

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("nav");
  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className={cn(
        "rounded-md p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 min-w-[40px] min-h-[40px] flex items-center justify-center",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
        className
      )}
      aria-label={t("theme")}
    >
      {resolvedTheme === "dark" ? (
        <Sun size={18} aria-hidden="true" />
      ) : (
        <Moon size={18} aria-hidden="true" />
      )}
    </button>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { publicKey, network, isConnecting, connect, disconnect } = useWallet();
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("nav");
  const [mobileOpen, setMobileOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerLabelId = useId();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Move focus into the drawer when it opens, and restore it to the trigger
  // when it closes — otherwise focus is left behind on a hidden button.
  // Guarded on a previous-open flag so mounting the navbar never steals focus.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (mobileOpen) {
      closeButtonRef.current?.focus();
    } else if (wasOpenRef.current && document.activeElement === document.body) {
      menuButtonRef.current?.focus();
    }
    wasOpenRef.current = mobileOpen;
  }, [mobileOpen]);

  // The drawer is modal: Escape closes it and Tab cycles within it, so keyboard
  // users can't wander into the inert content behind the overlay.
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setMobileOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !drawerRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta > 60) setMobileOpen(false);
    touchStartX.current = null;
  };

  const shortAddress = publicKey ? formatStellarAddress(publicKey) : null;

  const handleLanguageChange = (newLocale: string) => {
    router.push(pathname.replace(`/${locale}`, `/${newLocale}`));
    setMobileOpen(false);
  };

  const NAV_LINKS = [
    { href: "/", label: t("home") },
    { href: "/workers", label: t("workers") },
    { href: "/about", label: t("about") },
  ];

  const currentLanguageLabel =
    LANGUAGES.find((l) => l.code === locale)?.label ?? locale.toUpperCase();

  return (
    <>
      <nav
        aria-label={t("primaryNavigation")}
        className="sticky top-0 z-50 w-full border-b bg-white/90 backdrop-blur dark:bg-gray-900/90 dark:border-gray-800"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link
            href="/"
            className="rounded text-xl font-bold text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            BlueCollar
          </Link>

          <ul className="hidden list-none items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <NavLink {...l} />
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <NotificationDropdown />

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={t("changeLanguage", { language: currentLanguageLabel })}
                  className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Globe size={15} aria-hidden="true" />
                  {locale.toUpperCase()}
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[120px] rounded-md border bg-white p-1 shadow-md text-sm dark:bg-gray-900 dark:border-gray-700">
                  {LANGUAGES.map((lang) => (
                    <DropdownMenu.Item
                      key={lang.code}
                      onSelect={() => handleLanguageChange(lang.code)}
                      aria-current={lang.code === locale ? "true" : undefined}
                      className="cursor-pointer rounded px-3 py-2 hover:bg-gray-100 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-gray-800 dark:text-gray-200"
                    >
                      {lang.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {publicKey ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label={t("walletMenu")}
                    className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <Wallet size={15} aria-hidden="true" />
                    {shortAddress}
                    {network && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        network.toLowerCase().includes("test")
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      )}>
                        {network.toLowerCase().includes("test") ? t("testnet") : t("mainnet")}
                      </span>
                    )}
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content align="end" sideOffset={6} className="z-50 min-w-[180px] rounded-md border bg-white p-1 shadow-md text-sm dark:bg-gray-900 dark:border-gray-700">
                    <div className="px-3 py-2 text-xs text-gray-400 font-mono break-all">{publicKey}</div>
                    <DropdownMenu.Separator className="my-1 h-px bg-gray-100 dark:bg-gray-700" />
                    <DropdownMenu.Item onSelect={disconnect} className="cursor-pointer rounded px-3 py-2 text-red-600 hover:bg-red-50 outline-none dark:hover:bg-red-950">
                      {t("disconnectWallet")}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <button
                type="button"
                onClick={connect}
                disabled={isConnecting}
                aria-busy={isConnecting}
                className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Wallet size={15} aria-hidden="true" />
                {isConnecting ? t("connecting") : t("connectWallet")}
              </button>
            )}

            {user ? (
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
            ) : (
              <>
                <Link href="/auth/login" className="rounded-md px-3 py-1.5 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200">{t("login")}</Link>
                <Link href="/auth/register" className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700">{t("register")}</Link>
              </>
            )}
          </div>

          <button
            ref={menuButtonRef}
            type="button"
            className="md:hidden flex items-center justify-center rounded-md p-2 min-w-[44px] min-h-[44px] hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            onClick={() => setMobileOpen(true)}
            aria-label={t("openMenu")}
            aria-expanded={mobileOpen}
            aria-haspopup="dialog"
            aria-controls={mobileOpen ? drawerLabelId : undefined}
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden">
          {/* Click-to-dismiss backdrop. Escape and the close button cover the
              same action for keyboard users, so it is hidden from a11y tree. */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 bg-black/40 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <div
            ref={drawerRef}
            id={drawerLabelId}
            role="dialog"
            aria-modal="true"
            aria-label={t("mobileMenu")}
            className="fixed right-0 top-0 z-50 h-full w-72 bg-white dark:bg-gray-900 shadow-xl flex flex-col animate-slide-in-right"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-800">
              <span className="text-lg font-bold text-blue-600">BlueCollar</span>
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-center rounded-md p-2 min-w-[44px] min-h-[44px] text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  aria-label={t("closeMenu")}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-1">
              <ul className="list-none m-0 p-0 flex flex-col gap-1">
                {NAV_LINKS.map(({ href, label }) => {
                  const isActive = isPathActive(pathname, href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={() => setMobileOpen(false)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors min-h-[48px]",
                          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                          isActive
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        )}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
                          />
                        )}
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>

              <div className="my-2 h-px bg-gray-100 dark:bg-gray-800" aria-hidden="true" />

              <p
                id={`${drawerLabelId}-lang`}
                className="px-4 py-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500"
              >
                {t("language")}
              </p>
              <div role="group" aria-labelledby={`${drawerLabelId}-lang`} className="flex flex-col gap-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleLanguageChange(lang.code)}
                    aria-current={locale === lang.code ? "true" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-left min-h-[48px] w-full transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
                      locale === lang.code
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    )}
                  >
                    {locale === lang.code && (
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-blue-600 dark:bg-blue-400 shrink-0"
                      />
                    )}
                    {lang.label}
                  </button>
                ))}
              </div>

              <div className="my-2 h-px bg-gray-100 dark:bg-gray-800" aria-hidden="true" />

              {publicKey ? (
                <>
                  <div className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm min-h-[48px] dark:border-gray-700 dark:text-gray-200">
                    <Wallet size={16} aria-hidden="true" />
                    <span className="flex-1 font-mono text-xs truncate">{shortAddress}</span>
                    {network && (
                      <span className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                        network.toLowerCase().includes("test")
                          ? "bg-yellow-100 text-yellow-700"
                          : "bg-green-100 text-green-700"
                      )}>
                        {network.toLowerCase().includes("test") ? t("testnet") : t("mainnet")}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { disconnect(); setMobileOpen(false); }}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    {t("disconnectWallet")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => { connect(); setMobileOpen(false); }}
                  disabled={isConnecting}
                  aria-busy={isConnecting}
                  className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium min-h-[48px] hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <Wallet size={16} aria-hidden="true" />
                  {isConnecting ? t("connecting") : t("connectWallet")}
                </button>
              )}

              <div className="my-2 h-px bg-gray-100 dark:bg-gray-800" aria-hidden="true" />

              {user ? (
                <>
                  <Link href="/profile" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                    <User size={16} className="text-gray-400" aria-hidden="true" />
                    {t("profile")}
                  </Link>
                  <Link href="/messages" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                    <MessageSquare size={16} className="text-gray-400" aria-hidden="true" />
                    Messages
                  </Link>
                  {(user.role === "curator" || user.role === "admin") && (
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                      {t("dashboard")}
                    </Link>
                  )}
                  {user.role === "admin" && (
                    <Link href="/dashboard/admin" onClick={() => setMobileOpen(false)} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] hover:bg-gray-100 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                      {t("adminAnalytics")}
                    </Link>
                  )}
                  <button type="button" onClick={() => { logout(); setMobileOpen(false); }} className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm min-h-[48px] text-red-600 hover:bg-red-50 dark:hover:bg-red-950 transition-colors w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                    {t("logout")}
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2 pt-1">
                  <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="rounded-lg border px-4 py-3 text-center text-sm font-medium min-h-[48px] hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800 dark:text-gray-200 transition-colors">
                    {t("login")}
                  </Link>
                  <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="rounded-lg bg-blue-600 px-4 py-3 text-center text-sm font-medium min-h-[48px] text-white hover:bg-blue-700 transition-colors">
                    {t("register")}
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
