import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Stellar-domain helpers now live in the shared SDK. Re-exported here so
// existing `@/lib/utils` imports keep working without a repo-wide rename.
export {
  STROOPS_PER_XLM,
  MAX_DECIMAL_PLACES,
  formatWalletAddress,
  isValidStellarAddress,
} from '@bluecollar/sdk';

import { MAX_DECIMAL_PLACES as _MAX_DECIMAL_PLACES } from '@bluecollar/sdk';

let _locale = 'en-US';

export function setLocale(locale: string) {
  _locale = locale === 'en' ? 'en-US' : locale === 'pt' ? 'pt-BR' : `${locale}-${locale.toUpperCase()}`;
}

export function getLocale(): string {
  return _locale;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(_locale, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + '…';
}

/**
 * Locale-aware XLM formatter. The canonical (locale-agnostic) implementation
 * is in @bluecollar/sdk; this wrapper applies the app's active locale.
 */
export function formatXLM(stroops: number | bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString(_locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: _MAX_DECIMAL_PLACES,
  })} XLM`;
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat(_locale, { style: 'currency', currency }).format(amount);
}

export function formatNumber(num: number, opts?: Intl.NumberFormatOptions): string {
  return num.toLocaleString(_locale, opts);
}
