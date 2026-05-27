export const locales = ["en", "pt", "fr", "es"] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const localeLabels: Record<Locale, string> = {
  en: "English",
  pt: "Português",
  fr: "Français",
  es: "Español",
};

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function localizedPath(path: string, locale: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath === "/") {
    return `/${locale}`;
  }

  return `/${locale}${normalizedPath}`;
}

export function switchLocalePath(pathname: string, currentLocale: string, nextLocale: string) {
  if (pathname === `/${currentLocale}`) {
    return `/${nextLocale}`;
  }

  if (pathname.startsWith(`/${currentLocale}/`)) {
    return pathname.replace(`/${currentLocale}`, `/${nextLocale}`);
  }

  return localizedPath(pathname, nextLocale);
}
