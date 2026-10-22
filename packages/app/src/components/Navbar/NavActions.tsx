"use client";

import { Wallet, ChevronDown, Sun, Moon, Globe } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useTheme } from "next-themes";
import { useWallet } from "@/hooks/useWallet";
import { useLocale, useTranslations } from "next-intl";
import { cn, formatStellarAddress } from "@/lib/utils";
import NotificationDropdown from "@/components/NotificationDropdown";
import { WalletBalanceWidget } from "@/components/wallet/WalletBalanceWidget";

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
];

export function ThemeToggle({ className }: { className?: string }) {
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

/** Theme, notifications, language and wallet controls for the desktop bar. */
export function NavActions({ onLanguageChange }: { onLanguageChange: (code: string) => void }) {
  const { publicKey, network, isConnecting, connect, disconnect } = useWallet();
  const locale = useLocale();
  const t = useTranslations("nav");

  const shortAddress = publicKey ? formatStellarAddress(publicKey) : null;
  const currentLanguageLabel =
    LANGUAGES.find((l) => l.code === locale)?.label ?? locale.toUpperCase();

  return (
    <>
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
                onSelect={() => onLanguageChange(lang.code)}
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
              {/* Balance rendered via selector — only this sub-tree re-renders on balance change */}
              <div className="px-3 pb-2">
                <WalletBalanceWidget />
              </div>
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
    </>
  );
}
