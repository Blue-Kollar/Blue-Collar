import type { ReactNode } from "react";
import { Suspense } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/context/AuthContext";
import { WalletProvider } from "@/context/WalletContext";
import { CompareProvider } from "@/context/CompareContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import CompareDrawer from "@/components/CompareDrawer";
import BottomNav from "@/components/BottomNav";
import OnboardingTour from "@/components/OnboardingTour";
import WebVitalsReporter from "@/components/WebVitalsReporter";
import OfflineBanner from "@/components/OfflineBanner";
import InstallPrompt from "@/components/InstallPrompt";

// ── Deferred (non-critical) component wrappers to reduce CLS ─────────────────
function DeferredNonCritical() {
  return (
    <Suspense fallback={null}>
      <WebVitalsReporter />
      <OfflineBanner />
      <InstallPrompt />
      <CompareDrawer />
      <OnboardingTour />
    </Suspense>
  );
}

export default async function LocaleLayout({ 
  children, 
  params: { locale } 
}: { 
  children: ReactNode
  params: { locale: string } 
}) {
  const messages = await getMessages()

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        {/* ═══ Resource hints for Core Web Vitals ═══ */}
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000"} />
        <link rel="preconnect" href="https://horizon-testnet.stellar.org" />
        <link rel="dns-prefetch" href="https://horizon-testnet.stellar.org" />
        <link rel="preconnect" href="https://unpkg.com" />
        <link rel="dns-prefetch" href="https://unpkg.com" />

        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem storageKey="bc_theme">
            <QueryClientProvider client={queryClient}>
              <AuthProvider>
                <WalletProvider>
                  <CompareProvider>
                    <div id="main-content" tabIndex={-1}>
                      {children}
                    </div>
                    <DeferredNonCritical />
                  </CompareProvider>
                </WalletProvider>
              </AuthProvider>
            </QueryClientProvider>
            {/* Toaster rendered at fixed position — no layout impact */}
            <Toaster position="bottom-right" richColors closeButton />
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
