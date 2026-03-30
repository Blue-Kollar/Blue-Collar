import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from "next/server";

const PROTECTED = ["/dashboard"];
const locales = ['en', 'fr', 'es']
const defaultLocale = 'en'

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
    const locale = pathname.split('/')[1] || defaultLocale
    loginUrl.pathname = `/${locale}/auth/login`;
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return intlResponse;
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};
