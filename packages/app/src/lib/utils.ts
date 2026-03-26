import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Class merging
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a date string or Date object to a readable string
export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

// Truncate a string to maxLength, appending ellipsis if needed
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + "…";
}

// Show first 4 and last 4 chars of a wallet address: GABC…WXYZ
export function formatWalletAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

// Convert stroops (1 XLM = 10,000,000 stroops) to a formatted XLM string
export function formatXLM(stroops: number | bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 7 })} XLM`;
}
