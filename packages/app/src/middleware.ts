import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, isLocale, locales } from "@/lib/i18n";

const PROTECTED = ["/dashboard"];

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'always'
})

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // Apply i18n middleware
  const intlResponse = intlMiddleware(req)
  
  // Check protected routes
  const isProtected = PROTECTED.some((p) => pathname.includes(p));
  if (!isProtected) return intlResponse;

  const token =
    req.cookies.get("bc_token")?.value ??
    req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    const loginUrl = req.nextUrl.clone();
    const requestedLocale = pathname.split('/')[1] ?? defaultLocale
    const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale
    loginUrl.pathname = `/${locale}/auth/login`;
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
