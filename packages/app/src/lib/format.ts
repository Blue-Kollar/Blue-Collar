let locale = "en-US";

export function setLocale(value: string) {
  locale = value === "en" ? "en-US" : value === "pt" ? "pt-BR" : `${value}-${value.toUpperCase()}`;
}

export function getLocale(): string {
  return locale;
}

export function formatCurrency(amount: number | null | undefined, currency = "USD"): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return formatCurrency(0, currency);
  }
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatCompact(value: number | null | undefined, options: Intl.NumberFormatOptions = {}): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return formatCompact(0, options);
  }
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, options?: Intl.NumberFormatOptions): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (0).toLocaleString(locale, options);
  }
  return value.toLocaleString(locale, options);
}

export function formatAssetAmount(amount: number | null | undefined, currency: string): string {
  const formatted = formatNumber(amount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
  return `${formatted} ${currency}`;
}

function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function formatDate(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { year: "numeric", month: "short", day: "numeric" },
): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatDateTime(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  },
): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatTime(
  value: Date | string | number | null | undefined,
  options: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }
  return new Intl.DateTimeFormat(locale, options).format(date);
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
  ["second", 1000],
];

export function formatRelativeTime(
  value: Date | string | number | null | undefined,
  now: Date | number = Date.now(),
): string {
  const date = toDate(value);
  if (!date) {
    return "—";
  }
  const nowDate = now instanceof Date ? now : new Date(now);
  const diffMs = date.getTime() - nowDate.getTime();
  const absMs = Math.abs(diffMs);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (absMs >= ms || unit === "second") {
      const amount = Math.round(diffMs / ms);
      return rtf.format(amount, unit);
    }
  }

  return rtf.format(0, "second");
}