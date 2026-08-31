import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

let _locale = "en-US";

export function setLocale(locale: string) {
  _locale = locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : `${locale}-${locale.toUpperCase()}`;
}

export function getLocale(): string {
  return _locale;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(_locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + "…";
}

// Show first N and last N chars of a Stellar address (account or muxed): GABC…WXYZ
export function formatStellarAddress(
  address: string,
  { prefixLength = 4, suffixLength = 4 }: { prefixLength?: number; suffixLength?: number } = {}
): string {
  if (!address || address.length <= prefixLength + suffixLength) return address;
  return `${address.slice(0, prefixLength)}…${address.slice(-suffixLength)}`;
}

export function formatXLM(stroops: number | bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString(_locale, { minimumFractionDigits: 0, maximumFractionDigits: 7 })} XLM`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat(_locale, { style: "currency", currency }).format(amount);
}

export function formatNumber(num: number, opts?: Intl.NumberFormatOptions): string {
  return num.toLocaleString(_locale, opts);
}

/**
 * Format an ISO timestamp as a short time string, e.g. "3:45 PM".
 * Centralises the inline toLocaleTimeString calls from MessageThread.tsx.
 * Closes #1209
 */
export function formatTime(iso: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleTimeString(_locale, {
    hour: "numeric",
    minute: "2-digit",
    ...opts,
  });
}

/**
 * Format an ISO timestamp as a relative human-readable string,
 * e.g. "Just now", "5m ago", "3h ago", "2d ago", or a localised date
 * for anything older than `oldAfterDays` (default: 7 days).
 *
 * Centralises the ad-hoc `timeAgo` helpers that were previously duplicated
 * in ConversationList.tsx and notifications/page.tsx.
 * Closes #1209
 */
export function formatRelativeTime(iso: string | Date, oldAfterDays = 7): string {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < oldAfterDays) return `${days}d ago`;
  return date.toLocaleDateString(_locale, { month: "short", day: "numeric", year: "numeric" });
}
