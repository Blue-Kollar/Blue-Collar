let locale = "en-US";

export function setLocale(value: string) {
  locale = value === "en" ? "en-US" : value === "pt" ? "pt-BR" : `${value}-${value.toUpperCase()}`;
}

export function getLocale(): string {
  return locale;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
}

export function formatCompact(value: number, options: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 1,
    ...options,
  }).format(value);
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(locale, options);
}

export function formatAssetAmount(amount: number, currency: string): string {
  const formatted = formatNumber(amount, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 7,
  });
  return `${formatted} ${currency}`;
}